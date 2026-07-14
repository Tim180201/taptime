#!/usr/bin/env node
import { runBootstrapCli } from './cli.js';

process.exitCode = await runBootstrapCli(process.argv.slice(2));
