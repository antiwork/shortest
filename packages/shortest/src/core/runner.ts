import { watch } from 'chokidar';
import { glob } from 'glob';
import { resolve } from 'path';
import type { ShortestConfig } from '../config/types';
import { defaultConfig } from '../config/types';
import { Reporter } from './reporter';
import { TestCompiler } from './compiler';

export class TestRunner {
  private config!: ShortestConfig;
  private cwd: string;
  private reporter: Reporter;
  private exitOnSuccess: boolean;
  private compiler: TestCompiler;

  constructor(cwd: string, exitOnSuccess = true) {
    this.cwd = cwd;
    this.reporter = new Reporter();
    this.exitOnSuccess = exitOnSuccess;
    this.compiler = new TestCompiler();
  }

  async initialize() {
    const configFiles = [
      'shortest.config.ts',
      'shortest.config.js',
      'shortest.config.mjs'
    ];

    for (const file of configFiles) {
      try {
        const module = await this.compiler.loadModule(file, this.cwd);
        if (module.default) {
          this.config = { ...defaultConfig, ...module.default };
          return;
        }
      } catch (error) {
        continue;
      }
    }

    this.config = defaultConfig;
  }

  private async findTestFiles(pattern?: string): Promise<string[]> {
    const testDirs = Array.isArray(this.config.testDir) 
      ? this.config.testDir 
      : [this.config.testDir || '__tests__'];

    const files = [];
    for (const dir of testDirs) {
      if (pattern) {
        const cleanPattern = pattern
          .replace(/\.ts$/, '')
          .replace(/\.test$/, '')
          .split('/')
          .pop();
        
        const globPattern = `${dir}/**/${cleanPattern}.test.ts`;
        
        console.log('Clean pattern:', cleanPattern);
        console.log('Full glob pattern:', globPattern);
        
        const matches = await glob(globPattern, { 
          cwd: this.cwd,
          absolute: true
        });
        
        console.log('Found matches:', matches);
        files.push(...matches);
      } else {
        const globPattern = `${dir}/**/*.test.ts`;
        const matches = await glob(globPattern, { cwd: this.cwd });
        files.push(...matches.map(f => resolve(this.cwd, f)));
      }
    }

    if (files.length === 0) {
      console.log(`No test files found in directories: ${testDirs.join(', ')}`);
    }

    return files;
  }

  private async executeTest(file: string) {
    this.reporter.startFile(file);
    this.reporter.reportTest('Sample test');
  }

  async runFile(pattern: string) {
    await this.initialize();
    const files = await this.findTestFiles(pattern);
    
    if (files.length === 0) {
      console.error(`No test files found matching: ${pattern}`);
      process.exit(1);
    }

    for (const file of files) {
      await this.executeTest(file);
    }
    
    this.reporter.summary();

    if (this.exitOnSuccess && this.reporter.allTestsPassed()) {
      process.exit(0);
    }

    this.watchMode(files);
  }

  async runAll() {
    await this.initialize();
    const files = await this.findTestFiles();
    
    for (const file of files) {
      await this.executeTest(file);
    }
    
    this.reporter.summary();

    if (this.exitOnSuccess && this.reporter.allTestsPassed()) {
      process.exit(0);
    }

    this.watchMode(files);
  }

  private watchMode(files: string[]) {
    this.reporter.watchMode();
    
    const watcher = watch(files, {
      ignoreInitial: true
    });

    watcher.on('change', async (file) => {
      this.reporter.fileChanged(file);
      await this.executeTest(file);
      this.reporter.summary();
    });
  }
}
