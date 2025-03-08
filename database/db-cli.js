#!/usr/bin/env node

// Database CLI utility
// This script provides a command-line interface for database operations

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const db = require('./index');

// Parse command-line arguments
const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];
const options = args.slice(2);

// Help text
const helpText = `
Database CLI Utility for stray animal Finder

Usage:
  node db-cli.js <command> [subcommand] [options]

Commands:
  setup                Set up the database
  fix                  Fix database issues
    storage            Fix storage bucket issues
    rls                Fix Row Level Security issues
  test                 Run tests
    upload             Test image uploads
  clean                Clean up database
    files              Delete files from storage
  help                 Show this help text

Examples:
  node db-cli.js setup             # Set up the database
  node db-cli.js fix storage       # Fix storage bucket issues
  node db-cli.js test upload       # Test image uploads
  node db-cli.js clean files       # Delete files from storage
`;

// Execute a command
async function executeCommand() {
  try {
    switch (command) {
      case 'setup':
        console.log('Setting up the database...');
        await db.setupDatabase();
        break;
        
      case 'fix':
        switch (subCommand) {
          case 'storage':
            console.log('Fixing storage bucket issues...');
            await db.fixStorage();
            break;
            
          case 'rls':
            console.log('Fixing Row Level Security issues...');
            await db.fixRls();
            break;
            
          default:
            console.log('Invalid subcommand for "fix"');
            console.log(helpText);
            break;
        }
        break;
        
      case 'test':
        switch (subCommand) {
          case 'upload':
            console.log('Testing image uploads...');
            await db.testImageUpload();
            break;
            
          default:
            console.log('Invalid subcommand for "test"');
            console.log(helpText);
            break;
        }
        break;
        
      case 'clean':
        switch (subCommand) {
          case 'files':
            console.log('Cleaning up files from storage...');
            await db.deleteWithDelay();
            break;
            
          default:
            console.log('Invalid subcommand for "clean"');
            console.log(helpText);
            break;
        }
        break;
        
      case 'help':
      default:
        console.log(helpText);
        break;
    }
  } catch (error) {
    console.error('Error executing command:', error.message);
    process.exit(1);
  }
}

// Execute the command
executeCommand(); 