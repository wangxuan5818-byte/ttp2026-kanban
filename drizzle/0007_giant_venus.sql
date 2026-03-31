ALTER TABLE `tasks` ADD `managerUserId` varchar(100);--> statement-breakpoint
ALTER TABLE `tasks` ADD `contributorUserIds` json;