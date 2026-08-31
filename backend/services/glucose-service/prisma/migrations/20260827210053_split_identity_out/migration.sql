-- Identity moves out of this database and into auth-service.
--
-- The order matters and is not cosmetic: every foreign key is dropped before
-- any table is. `Patient.userId` referenced `User.id` ON DELETE CASCADE, and
-- that chain continues into GlucoseReading, CarbEvent, InsulinEvent and
-- AlertEvent — dropping "User" while the constraint still existed would take
-- the clinical data with it.
--
-- What this deliberately does NOT do is drop or recreate any clinical table.
-- Patient rows survive with their userId intact, now a plain UUID pointing at a
-- row in another database. That is the whole boundary: the id crosses, the
-- constraint does not.
--
-- The cost, stated plainly: this database can no longer prevent an orphaned
-- patient. Account deletion has to become an explicit cross-service operation.

-- DropForeignKey
ALTER TABLE "Administrator" DROP CONSTRAINT "Administrator_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuthCredential" DROP CONSTRAINT "AuthCredential_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuthSession" DROP CONSTRAINT "AuthSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "HealthProfessional" DROP CONSTRAINT "HealthProfessional_userId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_userId_fkey";

-- DropTable
DROP TABLE "AuthCredential";

-- DropTable
DROP TABLE "AuthSession";

-- DropTable
DROP TABLE "PasswordResetToken";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "UserRole";

-- DropEnum
DROP TYPE "UserStatus";

