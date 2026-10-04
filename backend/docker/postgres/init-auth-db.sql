-- Runs once, on first container start (docker-entrypoint-initdb.d convention).
-- POSTGRES_DB already creates the glucose database; auth needs a second one
-- in the same instance. MVP version of the original 4-database init script:
-- only the dev databases, no _test pair (tests keep running outside compose).
CREATE DATABASE glucore_auth_dev;
