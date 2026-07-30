const secret = process.env.JWT_SECRET;

if (!secret || secret.trim().length === 0) {
  console.error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
      'Set it in backend/.env (e.g. JWT_SECRET=$(openssl rand -hex 32)) before starting the server.',
  );
  process.exit(1);
}

export const JWT_SECRET: string = secret;
