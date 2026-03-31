CREATE TABLE `kanban_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`displayName` text NOT NULL,
	`role` enum('admin','committee') NOT NULL DEFAULT 'committee',
	`committeeId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kanban_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `kanban_users_username_unique` UNIQUE(`username`)
);
