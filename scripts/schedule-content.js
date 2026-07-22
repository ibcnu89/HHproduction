#!/usr/bin/env node
/**
 * Script to read markdown files from content/scheduled/ and insert them into scheduled_content table
 * 
 * Usage: DATABASE_URL=postgresql://... node scripts/schedule-content.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Content directory
const CONTENT_DIR = path.join(__dirname, '..', 'content', 'scheduled');

// Launch date: August 1, 2026
const LAUNCH_DATE = new Date('2026-08-01T00:00:00.000Z');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Parse frontmatter from markdown content
 * Returns { frontmatter, content } or { frontmatter: null, content }
 */
function parseFrontmatter(markdown) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: null, content: markdown };
  }
  
  const frontmatterText = match[1];
  const content = match[2];
  
  // Simple YAML parsing for our use case
  const frontmatter = {};
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, content };
}

/**
 * Infer content type, platform, and schedule from filename
 */
function inferFromFilename(filename) {
  const base = path.basename(filename, '.md');
  
  if (base === 'launch-blog-01') {
    return {
      type: 'blog',
      platform: 'website',
      scheduled_for: LAUNCH_DATE,
    };
  }
  
  if (base === 'onboarding-email-01') {
    return {
      type: 'email',
      platform: 'resend',
      scheduled_for: 'day_0',
    };
  }
  
  if (base === 'onboarding-email-02') {
    return {
      type: 'email',
      platform: 'resend',
      scheduled_for: 'day_2',
    };
  }
  
  if (base === 'onboarding-email-03') {
    return {
      type: 'email',
      platform: 'resend',
      scheduled_for: 'day_3',
    };
  }
  
  if (base === 'social-calendar-30day') {
    return {
      type: 'social_calendar',
      platform: 'multi',
      scheduled_for: 'multi_day',
    };
  }
  
  // Default fallback
  return {
    type: 'blog',
    platform: 'website',
    scheduled_for: LAUNCH_DATE,
  };
}

/**
 * Parse social-calendar-30day.md to extract individual posts
 */
function parseSocialCalendar(content) {
  const posts = [];
  
  // Split by day sections (### Day X)
  const dayRegex = /### Day (\d+)/g;
  const sections = [];
  let match;
  let lastIndex = 0;
  
  while ((match = dayRegex.exec(content)) !== null) {
    if (lastIndex > 0) {
      sections.push({ day: parseInt(lastDay), content: content.substring(lastIndex, match.index) });
    }
    lastDay = match[1];
    lastIndex = match.index;
  }
  
  // Add the last section
  if (lastIndex > 0) {
    sections.push({ day: parseInt(lastDay), content: content.substring(lastIndex) });
  }
  
  // Parse each day's content
  sections.forEach(section => {
    const dayContent = section.content;
    const dayNum = section.day;
    
    // Extract X posts (between ```)
    const xThreadRegex = /\*\*X (Thread|Single post)\*\*\s*\((\d+ tweets?)\):\n```\n([\s\S]*?)\n```/g;
    let xMatch;
    while ((xMatch = xThreadRegex.exec(dayContent)) !== null) {
      const type = xMatch[1].toLowerCase().includes('thread') ? 'x_thread' : 'x_post';
      const tweets = xMatch[2];
      const content = xMatch[3].trim();
      
      posts.push({
        day: dayNum,
        platform: 'x',
        type,
        content,
        tweetCount: parseInt(tweets.match(/\d+/)?.[0] || '1'),
      });
    }
    
    // Extract LinkedIn posts
    const linkedinRegex = /\*\*LinkedIn\*\*: ([^\n]+)/g;
    let liMatch;
    while ((liMatch = linkedinRegex.exec(dayContent)) !== null) {
      posts.push({
        day: dayNum,
        platform: 'linkedin',
        type: 'linkedin_post',
        content: liMatch[1].trim(),
        tweetCount: 1,
      });
    }
    
    // Extract Reddit posts
    const redditRegex = /\*\*Reddit\*\*\s*\(([^)]+)\): "([^"]+)"/g;
    let rdMatch;
    while ((rdMatch = redditRegex.exec(dayContent)) !== null) {
      posts.push({
        day: dayNum,
        platform: 'reddit',
        type: 'reddit_post',
        content: rdMatch[2].trim(),
        subreddit: rdMatch[1].trim(),
        tweetCount: 1,
      });
    }
    
    // Extract Blog posts
    const blogRegex = /\*\*Blog\*\*: ([^\n]+)/g;
    let blMatch;
    while ((blMatch = blogRegex.exec(dayContent)) !== null) {
      posts.push({
        day: dayNum,
        platform: 'blog',
        type: 'blog_post',
        content: blMatch[1].trim(),
        tweetCount: 1,
      });
    }
  });
  
  return posts;
}

/**
 * Calculate scheduled_for date based on day offset
 */
function calculateScheduledDate(dayOffset) {
  const date = new Date(LAUNCH_DATE);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

/**
 * Main function to schedule content
 */
async function scheduleContent() {
  const client = await pool.connect();
  let scheduledCount = 0;
  
  try {
    // Read all markdown files
    const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      const filePath = path.join(CONTENT_DIR, file);
      const markdown = fs.readFileSync(filePath, 'utf8');
      const { frontmatter, content } = parseFrontmatter(markdown);
      
      if (file === 'social-calendar-30day.md') {
        // Special handling for social calendar - parse individual posts
        const posts = parseSocialCalendar(content);
        
        for (const post of posts) {
          const scheduledDate = calculateScheduledDate(post.day);
          
          // Use title from content or generate from platform/day
          const title = `${post.platform.toUpperCase()} Day ${post.day}: ${post.content.substring(0, 80)}...`;
          
          await client.query(
            `INSERT INTO scheduled_content (title, content_type, text, platforms, subreddit, status, publish_at, meta)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT DO NOTHING`,
            [
              title,
              post.type,
              post.content,
              JSON.stringify([post.platform]),
              post.subreddit || null,
              'scheduled',
              scheduledDate.toISOString(),
              JSON.stringify({ day: post.day, platform: post.platform, tweetCount: post.tweetCount })
            ]
          );
          scheduledCount++;
        }
        
        console.log(`✓ Scheduled ${posts.length} social posts from ${file}`);
      } else {
        // Regular content files
        let title, contentType, platform, scheduledFor;
        
        if (frontmatter) {
          title = frontmatter.title || path.basename(file, '.md');
          contentType = frontmatter.content_type || frontmatter.type || 'blog';
          platform = frontmatter.platform || 'website';
          scheduledFor = frontmatter.scheduled_for || frontmatter.date;
        } else {
          const inferred = inferFromFilename(file);
          title = path.basename(file, '.md');
          contentType = inferred.type;
          platform = inferred.platform;
          scheduledFor = inferred.scheduled_for;
        }
        
        // Parse scheduled_for
        let scheduledDate;
        if (scheduledFor === 'day_0') {
          scheduledDate = LAUNCH_DATE;
        } else if (scheduledFor === 'day_2') {
          scheduledDate = calculateScheduledDate(2);
        } else if (scheduledFor === 'day_3') {
          scheduledDate = calculateScheduledDate(3);
        } else if (scheduledFor instanceof Date) {
          scheduledDate = scheduledFor;
        } else if (typeof scheduledFor === 'string' && !isNaN(Date.parse(scheduledFor))) {
          scheduledDate = new Date(scheduledFor);
        } else {
          scheduledDate = LAUNCH_DATE;
        }
        
        await client.query(
          `INSERT INTO scheduled_content (title, content_type, text, platforms, status, publish_at, meta)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [
            title,
            contentType,
            content,
            JSON.stringify([platform]),
            'scheduled',
            scheduledDate.toISOString(),
            JSON.stringify({ sourceFile: file, frontmatter })
          ]
        );
        scheduledCount++;
        
        console.log(`✓ Scheduled: ${title} (${contentType}/${platform}) for ${scheduledDate.toISOString()}`);
      }
    }
    
    console.log(`\n✅ Successfully scheduled ${scheduledCount} content items`);
    
  } catch (error) {
    console.error('❌ Error scheduling content:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
scheduleContent().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});