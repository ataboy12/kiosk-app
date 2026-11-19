CREATE TYPE "public"."answer_source" AS ENUM('COMPUTED', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('PROCESSING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."question_content" AS ENUM('GROUP', 'NUMBER', 'TEXT', 'ENUM', 'TABLE');--> statement-breakpoint
CREATE TABLE "answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"column_key" text DEFAULT '' NOT NULL,
	"computed_value" jsonb,
	"value" jsonb,
	"source" "answer_source" NOT NULL,
	"provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answer_importId_questionId_columnKey_unique" UNIQUE("import_id","question_id","column_key")
);
--> statement-breakpoint
CREATE TABLE "dsn_import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"content" text NOT NULL,
	"status" "import_status" DEFAULT 'PROCESSING' NOT NULL,
	"company_name" text,
	"siren" text,
	"period_start" date,
	"period_end" date,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" text PRIMARY KEY NOT NULL,
	"label_en" text NOT NULL,
	"label_fr" text NOT NULL,
	"content" "question_content" NOT NULL,
	"parent_id" text,
	"order" integer NOT NULL,
	"unit" text,
	"enum_en" text[] DEFAULT '{}' NOT NULL,
	"enum_fr" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer" ADD CONSTRAINT "answer_import_id_dsn_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."dsn_import"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer" ADD CONSTRAINT "answer_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_parent_id_question_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."question"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_parent_id_index" ON "question" USING btree ("parent_id");