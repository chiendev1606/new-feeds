CREATE TABLE "feed_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"generation" integer NOT NULL,
	CONSTRAINT "feed_state_single_row" CHECK ("feed_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"viewer_id" text NOT NULL,
	"key" text NOT NULL,
	"status" integer NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_viewer_id_key_pk" PRIMARY KEY("viewer_id","key")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"src" text NOT NULL,
	"alt" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"placeholder_color" text NOT NULL,
	"upload_bytes" "bytea",
	"content_type" text,
	"uploaded_by" text,
	CONSTRAINT "media_size_positive" CHECK ("media"."width" > 0 AND "media"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"body_text" text NOT NULL,
	"body_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"media_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"share_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction" text NOT NULL,
	CONSTRAINT "reactions_post_id_user_id_pk" PRIMARY KEY("post_id","user_id"),
	CONSTRAINT "reactions_reaction_valid" CHECK ("reactions"."reaction" IN ('like', 'love', 'haha', 'wow', 'sad', 'angry'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"handle" text NOT NULL,
	"avatar_color" text NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_feed_order_idx" ON "posts" USING btree ("created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);