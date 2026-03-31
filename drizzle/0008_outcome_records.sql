CREATE TABLE `outcome_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`committeeId` varchar(64) NOT NULL,
	`type` enum('提效','降本','增收') NOT NULL,
	`scenario` varchar(200) NOT NULL,
	`beforeValue` float NOT NULL,
	`afterValue` float NOT NULL,
	`unit` varchar(50) NOT NULL,
	`frequency` float DEFAULT 1,
	`remark` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outcome_records_id` PRIMARY KEY(`id`)
);
