CREATE TABLE IF NOT EXISTS `think_room` (
    `roomtypeid`       INT(11) UNSIGNED NOT NULL,
    `hotelid`          INT(11) UNSIGNED NOT NULL,
    `namechn`          VARCHAR(64) NOT NULL,
    `status`           INT(11) UNSIGNED NOT NULL DEFAULT 0,
    `original`         TEXT NOT NULL,
    `no_price_expires` BIGINT(13) UNSIGNED NOT NULL DEFAULT 0,
    `updated_at`       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`roomtypeid`),
    CONSTRAINT `hotelid` FOREIGN KEY (`hotelid`) REFERENCES `think_hotel` (`hotelid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
