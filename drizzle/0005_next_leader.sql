ALTER TABLE `score_records` ADD `projectValueLevel` enum('十万','百万','千万');--> statement-breakpoint
ALTER TABLE `score_records` ADD `gateName` enum('S门','A门','B门');--> statement-breakpoint
ALTER TABLE `score_records` ADD `monthlyScore` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `score_records` ADD `milestoneScore` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `score_records` ADD `mentorScore` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `score_records` ADD `mentorName` varchar(100);