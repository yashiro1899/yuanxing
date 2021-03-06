CREATE TABLE IF NOT EXISTS `think_goods` (
    `gid`        INT(11) UNSIGNED NOT NULL,
    `userid`     INT(11) UNSIGNED NOT NULL,
    `hotelid`    INT(11) UNSIGNED NOT NULL,
    `roomtypeid` INT(11) UNSIGNED NOT NULL,
    `status`     INT(11) UNSIGNED NOT NULL DEFAULT 3, -- 3: published, 4: connected
    `iid`        BIGINT(12) UNSIGNED NOT NULL,
    `ptype`      INT(11) UNSIGNED NOT NULL DEFAULT 0,
    `profit`     INT(11) UNSIGNED NOT NULL DEFAULT 0,
    `ratetype`   INT(11) UNSIGNED NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`gid`),
    KEY iid (`iid`),
    CONSTRAINT `userid` FOREIGN KEY (`userid`) REFERENCES `think_user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `hotelid3` FOREIGN KEY (`hotelid`) REFERENCES `think_hotel` (`hotelid`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `roomtypeid2` FOREIGN KEY (`roomtypeid`) REFERENCES `think_room` (`roomtypeid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
