CREATE TABLE `vehicle_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`action_type` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`vin` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year` integer NOT NULL,
	`colour` text NOT NULL,
	`price` real NOT NULL,
	`added_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vehicle_actions_vehicle_id` ON `vehicle_actions` (`vehicle_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_vin_unique` ON `vehicles` (`vin`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_added_at` ON `vehicles` (`added_at`);