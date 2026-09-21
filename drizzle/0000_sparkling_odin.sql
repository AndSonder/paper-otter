CREATE TABLE `exposures` (
	`user_id` text NOT NULL,
	`paper_id` text NOT NULL,
	`day` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`user_id`, `paper_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`user_id` text NOT NULL,
	`paper_id` text NOT NULL,
	`liked` integer DEFAULT 0 NOT NULL,
	`saved` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `paper_id`)
);
--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`user_id` text NOT NULL,
	`paper_id` text NOT NULL,
	`session_id` text NOT NULL,
	`seconds` integer DEFAULT 0 NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `paper_id`, `session_id`)
);
