ALTER TABLE "dsn_import" ADD COLUMN "employee_count" integer;--> statement-breakpoint
ALTER TABLE "dsn_import" ADD COLUMN "columns" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "dsn_import" ADD COLUMN "failures" jsonb DEFAULT '[]'::jsonb NOT NULL;