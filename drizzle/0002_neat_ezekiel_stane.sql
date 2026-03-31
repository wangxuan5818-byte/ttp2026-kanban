CREATE TABLE `score_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`committeeId` varchar(64) NOT NULL,
	`completionScore` float NOT NULL DEFAULT 0,
	`qualityScore` float NOT NULL DEFAULT 0,
	`timelinessScore` float NOT NULL DEFAULT 0,
	`collaborationScore` float NOT NULL DEFAULT 0,
	`totalScore` float NOT NULL DEFAULT 0,
	`roi` float,
	`bonusCoeff` float NOT NULL DEFAULT 0,
	`estimatedBonus` float NOT NULL DEFAULT 0,
	`aiSummary` text,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `score_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`committeeId` varchar(64) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`url` text NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`uploadedBy` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` varchar(64) NOT NULL,
	`committeeId` varchar(64) NOT NULL,
	`name` varchar(200) NOT NULL,
	`goal` text NOT NULL,
	`strategy` text NOT NULL,
	`actions` json NOT NULL DEFAULT ('[]'),
	`milestone` text,
	`result` text,
	`breakthrough` text,
	`manager` varchar(100),
	`contributors` json NOT NULL DEFAULT ('[]'),
	`dingDeptIds` json NOT NULL DEFAULT ('[]'),
	`deadline` varchar(20),
	`status` enum('进行中','已完成','待启动','有卡点') NOT NULL DEFAULT '待启动',
	`rewardPool` varchar(200),
	`inputManDays` float,
	`outputValue` float,
	`completionRate` float DEFAULT 0,
	`score` float DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
