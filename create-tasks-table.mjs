import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await createConnection(process.env.DATABASE_URL);

try {
  // TiDB does not support JSON DEFAULT ('[]'), so omit JSON defaults
  await conn.execute(`CREATE TABLE IF NOT EXISTS \`tasks\` (
    \`id\` varchar(64) NOT NULL,
    \`committeeId\` varchar(64) NOT NULL,
    \`name\` varchar(200) NOT NULL,
    \`goal\` text NOT NULL,
    \`strategy\` text NOT NULL,
    \`actions\` json,
    \`milestone\` text,
    \`result\` text,
    \`breakthrough\` text,
    \`manager\` varchar(100),
    \`contributors\` json,
    \`dingDeptIds\` json,
    \`deadline\` varchar(20),
    \`status\` enum('进行中','已完成','待启动','有卡点') NOT NULL DEFAULT '待启动',
    \`rewardPool\` varchar(200),
    \`inputManDays\` float,
    \`outputValue\` float,
    \`completionRate\` float DEFAULT 0,
    \`score\` float DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    \`createdBy\` int,
    PRIMARY KEY (\`id\`)
  )`);
  console.log('✅ tasks table created successfully');

  const [rows] = await conn.execute("SHOW TABLES LIKE 'tasks'");
  console.log('✅ Verification:', rows.length > 0 ? 'Table exists' : 'Table NOT found');
} catch(e) {
  console.error('❌ Error:', e.message);
} finally {
  await conn.end();
}
