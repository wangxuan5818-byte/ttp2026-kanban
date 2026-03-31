ALTER TABLE `committee_config` ADD `status` enum('active','paused','terminated') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `committee_config` ADD `dingTalkWebhook` varchar(500);