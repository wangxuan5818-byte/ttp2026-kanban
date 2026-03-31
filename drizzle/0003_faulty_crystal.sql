CREATE TABLE `committee_config` (
	`id` varchar(64) NOT NULL,
	`shortName` varchar(50) NOT NULL,
	`fullName` varchar(200) NOT NULL,
	`color` varchar(20) NOT NULL,
	`icon` varchar(20) NOT NULL,
	`chairman` varchar(100) NOT NULL,
	`director` varchar(100),
	`members` json,
	`responsibility` json,
	`annualGoal` text,
	`conditions` json,
	`rewardPool` text,
	`milestones` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `committee_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategic_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configKey` varchar(100) NOT NULL,
	`configValue` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `strategic_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `strategic_config_configKey_unique` UNIQUE(`configKey`)
);
--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `actions` json;--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `contributors` json;--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `dingDeptIds` json;