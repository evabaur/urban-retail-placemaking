CREATE TABLE `attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`course` text NOT NULL,
	`owner` text,
	`group_id` text,
	`parent` text,
	`data` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_kind_course` ON `records` (`kind`,`course`);--> statement-breakpoint
CREATE INDEX `records_kind_owner` ON `records` (`kind`,`owner`);--> statement-breakpoint
CREATE INDEX `records_parent` ON `records` (`parent`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	`actor` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`uni` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`course` text NOT NULL,
	`group_id` text,
	`password` text NOT NULL,
	`must_change` integer DEFAULT 1 NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`canvas_id` integer,
	`email` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_uni_unique` ON `users` (`uni`);--> statement-breakpoint
CREATE INDEX `users_course_group` ON `users` (`course`,`group_id`);