#!/usr/bin/env python3
"""
Railway Cron Worker — HHproduction
Runs all scheduled tasks internally instead of GitHub Actions.
"""

import os
import sys
import time
import signal
import logging
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

import schedule

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("cron-worker")

# Config
SCRIPTS_DIR = Path(__file__).parent
NODE = "node"
PYTHON = "python3"

# Global shutdown flag
shutdown_requested = False


def signal_handler(signum, frame):
    global shutdown_requested
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    shutdown_requested = True


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def run_cmd(cmd: list[str], env: dict = None, timeout: int = 300) -> tuple[bool, str]:
    """Run a command and return (success, output)."""
    full_env = {**os.environ, **(env or {})}
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=full_env,
            cwd=SCRIPTS_DIR.parent.parent,  # HHproduction-workdir
        )
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, f"Command timed out after {timeout}s"
    except Exception as e:
        return False, str(e)


# ── Job Definitions ────────────────────────────────────────────────────────────

def job_health_check():
    """Daily health check - 6 AM UTC"""
    logger.info("Running health check...")
    success, output = run_cmd(["curl", "-sf", "https://hhproduction-production.up.railway.app/health"])
    if not success:
        logger.error(f"Health check failed: {output}")
        # Alert via Discord webhook
        webhook = os.environ.get("DISCORD_OPS_WEBHOOK")
        if webhook:
            import json
            import urllib.request
            payload = json.dumps({
                "text": "🚨 HHproduction Health Check Failed",
                "blocks": [{
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": "*HHproduction Health Check Failed* ❌\nService: https://hhproduction-production.up.railway.app/health"}
                }]
            }).encode()
            req = urllib.request.Request(webhook, data=payload, headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=10)
    else:
        logger.info("Health check OK")


def job_mrr_snapshot():
    """MRR snapshot - midnight UTC"""
    logger.info("Running MRR snapshot...")
    success, output = run_cmd([NODE, "scripts/ops/mrr-snapshot.js"], timeout=300)
    if not success:
        logger.error(f"MRR snapshot failed: {output}")
    else:
        logger.info("MRR snapshot complete")


def job_stripe_webhook_verify():
    """Stripe webhook verify - every 15 minutes"""
    logger.info("Verifying Stripe webhook...")
    success, output = run_cmd(["curl", "-sf", "https://hhproduction-production.up.railway.app/api/billing/webhook/health"])
    if not success:
        logger.warning(f"Stripe webhook health check failed: {output}")


def job_resend_webhook_verify():
    """Resend webhook verify - every 15 minutes"""
    logger.info("Verifying Resend webhook...")
    success, output = run_cmd(["curl", "-sf", "https://hhproduction-production.up.railway.app/api/webhooks/resend/health"])
    if not success:
        logger.warning(f"Resend webhook health check failed: {output}")


def job_outreach_batch():
    """Daily outreach batch - Mon-Fri 10 AM UTC"""
    logger.info("Running outreach batch...")
    env = {
        "DATABASE_URL": os.environ.get("DATABASE_URL"),
        "RESEND_API_KEY": os.environ.get("RESEND_API_KEY"),
        "DISCORD_OPS_WEBHOOK": os.environ.get("DISCORD_OPS_WEBHOOK"),
    }
    success, output = run_cmd([NODE, "scripts/ops/outreach-send-v2.js"], env=env, timeout=600)
    if not success:
        logger.error(f"Outreach batch failed: {output}")
    else:
        logger.info("Outreach batch complete")


def job_trial_expiry():
    """Trial expiry notify - 9 AM UTC daily"""
    logger.info("Running trial expiry notify...")
    env = {
        "DATABASE_URL": os.environ.get("DATABASE_URL"),
        "RESEND_API_KEY": os.environ.get("RESEND_API_KEY"),
        "DISCORD_OPS_WEBHOOK": os.environ.get("DISCORD_OPS_WEBHOOK"),
    }
    success, output = run_cmd([NODE, "scripts/ops/trial-expiry-notify.js"], env=env, timeout=300)
    if not success:
        logger.error(f"Trial expiry notify failed: {output}")
    else:
        logger.info("Trial expiry notify complete")


def job_weekly_content_publish():
    """Weekly content publish - Mon 9 AM UTC"""
    logger.info("Running weekly content publish...")
    env = {
        "DATABASE_URL": os.environ.get("DATABASE_URL"),
        "DISCORD_OPS_WEBHOOK": os.environ.get("DISCORD_OPS_WEBHOOK"),
    }
    success, output = run_cmd([NODE, "scripts/ops/publish-scheduled-content.js"], env=env, timeout=300)
    if not success:
        logger.error(f"Weekly content publish failed: {output}")
    else:
        logger.info("Weekly content publish complete")


def job_db_backup_verify():
    """DB backup verify - Sun 3 AM UTC"""
    logger.info("Running DB backup verify...")
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        logger.error("DATABASE_URL not set")
        return
    
    import gzip
    backup_path = f"/tmp/backup_{datetime.now().strftime('%F')}.sql.gz"
    try:
        proc = subprocess.run(
            ["pg_dump", db_url],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=300,
        )
        if proc.returncode != 0:
            logger.error(f"pg_dump failed: {proc.stderr.decode()}")
            return
        with gzip.GzipFile(fileobj=open(backup_path, "wb"), mode="wb") as gz:
            gz.write(proc.stdout)
        
        if Path(backup_path).stat().st_size > 0:
            logger.info(f"Backup OK: {backup_path}")
        else:
            logger.error("Backup file is empty")
    except Exception as e:
        logger.error(f"DB backup verify failed: {e}")


def job_ssl_cert_check():
    """SSL cert check - 1st of month 12 PM UTC"""
    logger.info("Running SSL cert check...")
    success, output = run_cmd([
        "bash", "-c",
        "openssl x509 -enddate -noout -in <(openssl s_client -connect hhproduction-production.up.railway.app:443 -servername hhproduction-production.up.railway.app </dev/null 2>/dev/null) | grep -q \"$(date -d '+30 days' +'%b %d')\" && echo OK || echo EXPIRING"
    ])
    if "EXPIRING" in output:
        logger.warning("SSL cert expiring within 30 days")
    else:
        logger.info("SSL cert OK")


def job_outreach_monitor():
    """Hourly outreach monitor"""
    logger.info("Running hourly outreach monitor...")
    success, output = run_cmd([NODE, "scripts/ops/outreach-monitor.js"], timeout=120)
    if not success:
        logger.error(f"Outreach monitor failed: {output}")


def job_x_post_pipeline():
    """Daily X/Twitter post pipeline - Mon-Fri 8 AM UTC"""
    logger.info("Running X/Twitter post pipeline...")
    success, output = run_cmd([NODE, "scripts/ops/x-post-pipeline.js"], timeout=120)
    if not success:
        logger.error(f"X post pipeline failed: {output}")
    else:
        logger.info("X post pipeline complete")


def job_x_engagement():
    """Daily X/Twitter engagement tracker - 9 PM UTC"""
    logger.info("Running X/Twitter engagement tracker...")
    success, output = run_cmd([NODE, "scripts/ops/x-engagement-tracker.js"], timeout=120)
    if not success:
        logger.error(f"X engagement tracker failed: {output}")
    else:
        logger.info("X engagement tracker complete")


def job_marketing_dashboard():
    """Daily marketing dashboard - 7 AM UTC"""
    logger.info("Running marketing dashboard...")
    success, output = run_cmd([NODE, "scripts/ops/marketing-dashboard.js"], timeout=120)
    if not success:
        logger.error(f"Marketing dashboard failed: {output}")
    else:
        logger.info("Marketing dashboard complete")


# ── Schedule Setup ─────────────────────────────────────────────────────────────

SCHEDULES = [
    # (cron_expression, job_function, description)
    ("0 6 * * *", job_health_check, "Daily health check"),
    ("0 0 * * *", job_mrr_snapshot, "MRR snapshot"),
    ("*/15 * * * *", job_stripe_webhook_verify, "Stripe webhook verify"),
    ("*/15 * * * *", job_resend_webhook_verify, "Resend webhook verify"),
    ("0 10 * * 1-5", job_outreach_batch, "Outreach batch (Mon-Fri)"),
    ("0 9 * * *", job_trial_expiry, "Trial expiry notify"),
    ("0 9 * * 1", job_weekly_content_publish, "Weekly content publish (Mon)"),
    ("0 3 * * 0", job_db_backup_verify, "DB backup verify (Sun)"),
    ("0 12 1 * *", job_ssl_cert_check, "SSL cert check (1st of month)"),
    ("0 * * * *", job_outreach_monitor, "Hourly outreach monitor"),
    ("0 8 * * 1-5", job_x_post_pipeline, "X post pipeline (Mon-Fri)"),
    ("0 21 * * *", job_x_engagement, "X engagement tracker"),
    ("0 7 * * *", job_marketing_dashboard, "Marketing dashboard"),
]


def setup_schedules():
    """Convert cron expressions to schedule jobs."""
    for cron_expr, job_func, desc in SCHEDULES:
        # schedule library doesn't support full cron, so we map common patterns
        parts = cron_expr.split()
        minute, hour, day, month, dow = parts
        
        if cron_expr == "*/15 * * * *":
            schedule.every(15).minutes.do(job_func).tag(desc)
        elif cron_expr == "0 * * * *":
            schedule.every().hour.at(":00").do(job_func).tag(desc)
        elif cron_expr.startswith("0 "):
            if dow == "*" and day == "*" and month == "*":
                # Daily at specific hour:minute
                schedule.every().day.at(f"{int(hour):02d}:{int(minute):02d}").do(job_func).tag(desc)
            elif dow != "*" and day == "*" and month == "*":
                # Weekly on specific day(s)
                dow_map = {"0": "sunday", "1": "monday", "2": "tuesday", "3": "wednesday", 
                          "4": "thursday", "5": "friday", "6": "saturday"}
                if "-" in dow:
                    start, end = dow.split("-")
                    for d in range(int(start), int(end)+1):
                        getattr(schedule.every(), dow_map[str(d)]).at(f"{int(hour):02d}:{int(minute):02d}").do(job_func).tag(desc)
                else:
                    getattr(schedule.every(), dow_map[dow]).at(f"{int(hour):02d}:{int(minute):02d}").do(job_func).tag(desc)
            elif day != "*" and month == "*" and dow == "*":
                # Monthly on specific day
                if day == "1":
                    schedule.every().day.at(f"{int(hour):02d}:{int(minute):02d}").do(job_func).tag(desc)
                    # Filter to 1st of month inside job
        else:
            logger.warning(f"Unsupported cron pattern: {cron_expr} for {desc}")
    
    logger.info(f"Scheduled {len(SCHEDULES)} jobs")


def run_pending():
    """Run pending scheduled jobs."""
    schedule.run_pending()


# ── Main Loop ──────────────────────────────────────────────────────────────────

def main():
    logger.info("=== HHproduction Cron Worker Starting ===")
    logger.info(f"Environment: {os.environ.get('RAILWAY_ENVIRONMENT', 'local')}")
    logger.info(f"Database: {'configured' if os.environ.get('DATABASE_URL') else 'NOT CONFIGURED'}")
    logger.info(f"Resend: {'configured' if os.environ.get('RESEND_API_KEY') else 'NOT CONFIGURED'}")
    logger.info(f"Discord webhook: {'configured' if os.environ.get('DISCORD_OPS_WEBHOOK') else 'NOT CONFIGURED'}")
    
    setup_schedules()
    
    logger.info("Entering main loop...")
    while not shutdown_requested:
        run_pending()
        time.sleep(1)
    
    logger.info("Cron worker shutdown complete")


if __name__ == "__main__":
    main()