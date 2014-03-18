CREATE TABLE IF NOT EXISTS `think_room` (
    `roomtypeid` INT(11) UNSIGNED NOT NULL,
    `hotelid`    INT(11) UNSIGNED NOT NULL,
    `namechn`    VARCHAR(64) NOT NULL,
    `status`     INT(11) UNSIGNED NOT NULL,
    `taobao_rid` INT(11) UNSIGNED NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`roomtypeid`),
    KEY taobao_rid (`taobao_rid`),
    CONSTRAINT `hotelid` FOREIGN KEY (`hotelid`) REFERENCES `think_hotel` (`hotelid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
