#!/usr/bin/env node
/**
 * Retention Cleanup Cron Job
 * Runs daily at 2 AM UTC to clean up expired data per retention_policies table
 * 
 * Usage: node scripts/ops/retention-cleanup.js
 * Schedule: 0 2 * * * (daily at 2 AM UTC)
 */

import { getClient } from '../../lib/db.js';
import crypto from 'crypto';

async function runRetentionCleanup() {
  console.log(`[${new Date().toISOString()}] Starting retention cleanup...`);
  
  const client = await getClient();
  let totalCleaned = 0;
  let totalErrors = 0;
  
  try {
    // 1. Get all active retention policies
    const policiesResult = await client.query(
      `SELECT resource_type, retention_days, description 
       FROM retention_policies 
       WHERE retention_days > 0`
    );
    
    if (policiesResult.rows.length === 0) {
      console.log('No active retention policies found');
      return { cleaned: 0, errors: 0 };
    }
    
    console.log(`Found ${policiesResult.rows.length} retention policies`);
    
    for (const policy of policiesResult.rows) {
      const { resource_type, retention_days } = policy;
      const cutoffDate = new Date(Date.now() - retention_days * 24 * 60 * 60 * 1000);
      const cutoffISO = cutoffDate.toISOString();
      
      console.log(`\nProcessing ${resource_type} (retention: ${retention_days} days, cutoff: ${cutoffISO})`);
      
      try {
        let cleaned = 0;
        
        switch (resource_type) {
          case 'grading_images':
            // Images are stored in memory (multer.memoryStorage) - no disk cleanup needed
            // But we can track in audit_logs that this ran
            console.log('  grading_images: using memoryStorage (no disk cleanup needed)');
            cleaned = 0;
            break;
            
          case 'batch_results':
            // Soft delete batch_grading_sessions older than retention
            const batchResult = await client.query(
              `UPDATE batch_grading_sessions 
               SET deleted_at = NOW() 
               WHERE deleted_at IS NULL 
               AND created_at < $1`,
              [cutoffISO]
            );
            cleaned = batchResult.rowCount;
            console.log(`  Soft-deleted ${cleaned} batch sessions`);
            break;
            
          case 'classroom_sync_logs':
            // Hard delete old sync logs
            const syncResult = await client.query(
              `DELETE FROM classroom_sync_log 
               WHERE started_at < $1`,
              [cutoffISO]
            );
            cleaned = syncResult.rowCount;
            console.log(`  Hard-deleted ${cleaned} sync logs`);
            break;
            
          case 'audit_logs':
            // Hard delete old audit logs
            const auditResult = await client.query(
              `DELETE FROM audit_logs 
               WHERE created_at < $1`,
              [cutoffISO]
            );
            cleaned = auditResult.rowCount;
            console.log(`  Hard-deleted ${cleaned} audit logs`);
            break;
            
          case 'grading_results':
            // Soft delete individual grading results older than retention
            // Note: This would be student_grading_results table when created
            console.log('  grading_results: table not yet created (Phase 3)');
            cleaned = 0;
            break;
            
          default:
            console.log(`  Unknown resource_type: ${resource_type}, skipping`);
            cleaned = 0;
        }
        
        totalCleaned += cleaned;
        
        // Log the cleanup action to audit_logs
        try {
          await client.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
             VALUES (NULL, 'retention_cleanup', $1, NULL, $2)`,
            [resource_type, JSON.stringify({ retention_days, cleaned, cutoff: cutoffISO })]
          );
        } catch (auditErr) {
          console.error(`  Failed to log audit for ${resource_type}:`, auditErr.message);
        }
        
      } catch (policyErr) {
        console.error(`  Error processing ${resource_type}:`, policyErr.message);
        totalErrors++;
      }
    }
    
    console.log(`\n[${new Date().toISOString()}] Retention cleanup complete. Total cleaned: ${totalCleaned}, Errors: ${totalErrors}`);
    
    return { cleaned: totalCleaned, errors: totalErrors };
    
  } catch (err) {
    console.error('Retention cleanup failed:', err);
    totalErrors++;
    return { cleaned: totalCleaned, errors: totalErrors };
  } finally {
    client.release();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRetentionCleanup()
    .then(result => {
      console.log('Final result:', result);
      process.exit(result.errors > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

export { runRetentionCleanup };