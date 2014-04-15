CREATE TABLE IF NOT EXISTS `think_taobaoroom` (
    `rid`        INT(11) UNSIGNED NOT NULL,
    `hid`        INT(11) UNSIGNED NOT NULL,
    `roomtypeid` INT(11) UNSIGNED NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`rid`),
    CONSTRAINT `hid` FOREIGN KEY (`hid`) REFERENCES `think_taobaohotel` (`hid`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `roomtypeid1` FOREIGN KEY (`roomtypeid`) REFERENCES `think_room` (`roomtypeid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
