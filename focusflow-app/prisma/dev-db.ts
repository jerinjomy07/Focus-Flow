// prisma/dev-db.ts
import ep from 'embedded-postgres';
import path from 'path';
import { execSync } from 'child_process';

const EmbeddedPostgresClass = (
  typeof ep === 'function' ? ep : (ep as unknown as { default: unknown }).default
) as new (options: Record<string, unknown>) => {
  start(): Promise<void>;
  initialise(): Promise<void>;
  createDatabase(name: string): Promise<void>;
};

async function run() {
  const port = 5432;
  const dataDir = path.resolve(process.cwd(), '.dev-pg-data');
  const pgInstance = new EmbeddedPostgresClass({
    port,
    user: 'postgres',
    password: 'postgres',
    databaseDir: dataDir,
    persistent: true,
    createPostgresUser: false,
    onLog: () => {},
    onError: () => {},
  });

  try {
    await pgInstance.start();
  } catch {
    try {
      await pgInstance.initialise();
      await pgInstance.start();
    } catch {
      // Ignored
    }
  }

  try {
    await pgInstance.createDatabase('focusflow');
  } catch {
    // Database may already exist
  }

  const dbUrl = 'postgresql://postgres:postgres@localhost:5432/focusflow?schema=public';
  console.log('Syncing database schema via migrations...');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl },
    stdio: 'inherit',
  });

  console.log('Seeding initial data...');
  try {
    execSync('npx tsx prisma/seed.ts', {
      env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl },
      stdio: 'ignore',
    });
  } catch {
    // Already seeded or seed handled
  }

  console.log('DATABASE_READY');

  // Keep alive
  setInterval(() => {}, 10000);
}

run().catch((err) => {
  console.error('Failed to start embedded Postgres:', err);
  process.exit(1);
});
