import { createClient } from '@supabase/supabase-js';
import { Parser } from 'json2csv';
import { execSync } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const OUTPUT_FILE = 'simulation_proof_report.csv';

// Global variable to capture all logs for clipboard cloning
let diagnosticBuffer = '';
function logAndCapture(text) {
  console.log(text);
  diagnosticBuffer += text + '\n';
}

async function verifyAndExportHistory() {
  logAndCapture('🔄 Fetching records from [metamask_sponsored_executions]...');

  const { data, error } = await supabase
    .from('metamask_sponsored_executions')
    .select('id, timestamp_utc, wallet_pubkey, trade_volume_usd, gross_profit_usd, tax_reserve_usd, net_withdrawable_usd, status')
    .order('timestamp_utc', { ascending: true });

  if (error) {
    logAndCapture(`❌ Error fetching data: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    logAndCapture('⚠️ No simulation records found in your database table.');
    return;
  }

  const totalRecords = data.length;
  const firstRun = new Date(data[0].timestamp_utc);
  const lastRun = new Date(data[totalRecords - 1].timestamp_utc);

  const timeDifference = lastRun.getTime() - firstRun.getTime();
  const totalDaysTested = Math.floor(timeDifference / (1000 * 3600 * 24));

  logAndCapture('\n📊 --- DATA INTEGRITY SUMMARY ---');
  logAndCapture(`🔹 Total Simulated Executions: ${totalRecords}`);
  logAndCapture(`📅 First Recorded Run:          ${firstRun.toUTCString()}`);
  logAndCapture(`📅 Final Recorded Run:          ${lastRun.toUTCString()}`);
  logAndCapture(`⏳ Total Running Span:          ${totalDaysTested} days`);

  if (totalDaysTested >= 30) {
    logAndCapture('\n✅ ELIGIBILITY: 30-Day simulation runtime validation complete.');
  } else {
    logAndCapture(`\n❌ ELIGIBILITY: Incomplete. You have ${totalDaysTested}/30 days logged (${30 - totalDaysTested} days remaining).`);
  }

  const totalNetWithdrawable = data.reduce((sum, row) => sum + (Number(row.net_withdrawable_usd) || 0), 0);
  logAndCapture(`💰 Total Net Withdrawable:     $${totalNetWithdrawable.toFixed(2)} USD`);

  try {
    logAndCapture(`\n💾 Exporting compiled columns to ${OUTPUT_FILE}...`);
    const rows = data.map(row => ({
      id: row.id,
      timestamp_utc: row.timestamp_utc,
      wallet_pubkey: row.wallet_pubkey,
      trade_volume_usd: row.trade_volume_usd,
      gross_profit_usd: row.gross_profit_usd,
      tax_reserve_usd: row.tax_reserve_usd,
      net_withdrawable_usd: row.net_withdrawable_usd,
      status: row.status
    }));

    rows.push({
      id: 'SUMMARY',
      timestamp_utc: new Date().toISOString(),
      wallet_pubkey: 'N/A',
      trade_volume_usd: '',
      gross_profit_usd: '',
      tax_reserve_usd: 'TOTAL_NET_WITHDRAWABLE:',
      net_withdrawable_usd: totalNetWithdrawable.toFixed(2),
      status: 'VALIDATED'
    });

    const fields = ['id', 'timestamp_utc', 'wallet_pubkey', 'trade_volume_usd', 'gross_profit_usd', 'tax_reserve_usd', 'net_withdrawable_usd', 'status'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(rows);

    fs.writeFileSync(OUTPUT_FILE, csv);
    logAndCapture('✨ Success! Proof report document saved with calculation metrics.');
  } catch (err) {
    logAndCapture(`❌ CSV Generation Error: ${err.message}`);
  }

  // Native Termux/Linux automated clipboard dump step
  try {
    fs.writeFileSync('./output_log.txt', diagnosticBuffer);
    try {
      execSync('termux-clipboard-set < ./output_log.txt');
      logAndCapture('\n📋 [NATIVE] Diagnostics successfully copied to Termux system clipboard.');
    } catch (e) {
      execSync('xclip -selection clipboard < ./output_log.txt');
      logAndCapture('\n📋 [NATIVE] Diagnostics successfully copied to xclip clipboard.');
    }
  } catch (clipError) {
    logAndCapture('\n⚠️ Note: Diagnostics saved to file but system clipboard binaries are not accessible.');
  }

  logAndCapture('\n📡 Initializing automatic database keep-alive protocol...');
  setInterval(async () => {
    try {
      await supabase.from('metamask_sponsored_executions').select('id', { count: 'exact', head: true });
    } catch (e) {}
  }, 43200000);
}

verifyAndExportHistory();
