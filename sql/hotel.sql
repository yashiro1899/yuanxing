CREATE TABLE IF NOT EXISTS `think_hotel` (
    `hotelid`    INT(11) UNSIGNED NOT NULL,
    `hotelcd`    VARCHAR(32) NOT NULL,
    `namechn`    VARCHAR(64) NOT NULL,
    `nameeng`    VARCHAR(64) DEFAULT "",
    `country`    INT(11) UNSIGNED NOT NULL,
    `state`      INT(11) UNSIGNED NOT NULL,
    `city`       INT(11) UNSIGNED NOT NULL,
    `website`    VARCHAR(128) DEFAULT "",
    `taobao_hid` INT(11) UNSIGNED DEFAULT 0,
    PRIMARY KEY (`hotelid`),
    KEY country (`country`),
    KEY state (`state`),
    KEY city (`city`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
