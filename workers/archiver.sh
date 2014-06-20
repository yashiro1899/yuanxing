#!/bin/bash
log="/alidata1/ice/yuanxing/logs/supervisor-yuanxing.log"
cp $log "$log.$(date +%F)" && > $log
