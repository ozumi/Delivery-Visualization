var express = require('express');
var router = express.Router();
var moment = require('moment-timezone');
var mysqlDB = require('../db-connect');

const fs = require('fs');
const parse = require('csv-parser');
var userData, friendList, networkData, result, metaData, tempData;
var orderData, storeList, customerList, uniqueStore, uniqueCustomer, startDate, endDate;

router.get('/network_csv', function (req, res, next) {
    userData = {};
    friendList = {};
    networkData = {"node":[], "link":[]};
    result = {};
    metaData = {};
    startDate = new Date();
    endDate = new Date();
    tempData = new Date();
    var init = true;

    fs.createReadStream('data/user.csv')
        .pipe(parse())
        .on('data', (row) => {
            userData[row.UID] = {};
            userData[row.UID]["name"] = row.DISPLAY_NAME;
            userData[row.UID]["email"] =row.EMAIL;
            userData[row.UID]["signUp"] =row.CREATED_AT;
            userData[row.UID]["friendNum"] = 0;
            userData[row.UID]["registerRoute"] = 0;
            userData[row.UID]["refereNum"] = 0;
            userData[row.UID]["parentInfo"] = "Root";

            var dateParse = moment(row.CREATED_AT, "YYYY.MM.DD HH:mm");
            tempDate = dateParse.toDate();

            if (init) {
                startDate = tempDate
                endDate = tempDate
                init = false
            }else {
                if (tempDate < startDate)
                    startDate = tempDate
                if (tempDate > endDate )
                    endDate = tempDate
            }
        })
        .on('end', () => {
            next();
        });
}, function (req, res, next) {
    var maxDepth = 0;
    fs.createReadStream('data/friend.csv')
        .pipe(parse())
        .on('data', (row) => {
            if (row.REASON == 'referer') {

                userData[row.FRIEND_UID]["parentInfo"] = row.UID;

                if (!(row.UID in friendList)) {
                    friendList[row.UID] = [];
                }

                friendList[row.UID].push({'friendID': row.FRIEND_UID, 'type': row.SOCIAL_TYPE});
                userData[row.UID]["refereNum"] ++;

                if (userData[row.UID]["registerRoute"]!=3) {
                    if (userData[row.UID]["registerRoute"] == 2)
                        userData[row.UID]["registerRoute"] = 3;
                    else
                        userData[row.UID]["registerRoute"] = 1;
                }

                if (userData[row.FRIEND_UID]["registerRoute"]!=3) {
                    if (userData[row.FRIEND_UID]["registerRoute"]==1)
                        userData[row.FRIEND_UID]["registerRoute"] = 3;
                    else
                        userData[row.FRIEND_UID]["registerRoute"] = 2;
                }
            }
        })
        .on('end', () => {
            var totalUser = 0;
            var referral = 0;
            var referrer = 0;
            var referree = 0;
            Object.keys(userData).map(function(key) {
                if(key!="undefined") {
                    totalUser++;
                    var myParent = userData[key].parentInfo;
                    if (myParent == 'Root') {
                        if (userData[key]["refereNum"]>0) {
                            referral++;
                            referrer++;
                        }
                    } else {
                        referral++;
                        if (userData[key]["refereNum"]>0) {
                            referrer++;
                            referree++;
                        } else
                            referree++;
                    }

                    var refereDepth = 0;
                    while (myParent !== 'Root') {
                        myParent = userData[myParent].parentInfo;
                        refereDepth++
                    }
                    if (maxDepth<refereDepth)
                        maxDepth = refereDepth;

                    networkData["node"].push({
                        "name": userData[key]["name"],
                        "id": key,
                        "refere_num": userData[key]["refereNum"],
                        "group": userData[key]["registerRoute"],
                        "depth": refereDepth
                    });
                }
            })
            Object.keys(friendList).map(function(key) {
                friends = friendList[key]
                friends.map(function(myFriend){
                    if (key in userData && myFriend.friendID in userData)
                        networkData["link"].push({"source": key, "target": myFriend.friendID, "value": myFriend.type});
                })
            })
            console.log('CSV file successfully processed');

            metaData = {"maxDepth": maxDepth, "totalUser": totalUser, "referral": referral, "referrer": referrer, "referree": referree, "startDate": startDate, "endDate": endDate};
            result["metaData"] = metaData;
            result["networkData"] = networkData;
            result["userData"] = userData;
            res.send(result);
        });
});

router.get('/order_csv', function (req, res, next) {
    orderData = {};
    result = {};
    storeList = {};
    customerList = {};
    uniqueStore = [];
    uniqueCustomer = [];
    startDate = new Date();
    endDate = new Date();
    var init = true;
    tempData = new Date();
    fs.createReadStream('data/order_dist.csv')
        .pipe(parse())
        .on('data', (row) => {
            if(row.ORDER_ID != null) {
                orderData[row.ORDER_ID] = {};
                orderData[row.ORDER_ID]['userID'] = row.UID;
                orderData[row.ORDER_ID]['name'] = row.DISPLAY_NAME;
                orderData[row.ORDER_ID]['amount'] = Number(row.AMOUNT);
                orderData[row.ORDER_ID]['service'] = row.SERVICE_PROVIDER;
                orderData[row.ORDER_ID]['address'] = row.ADDRESS;
                orderData[row.ORDER_ID]['customerLat'] = Number(row.CUSTOMER_ADDRESS_LAT);
                orderData[row.ORDER_ID]['customerLng'] = Number(row.CUSTOMER_ADDRESS_LNG);
                // orderData[row.ORDER_ID]['dist'] = Number(row.DISTANCE);

                var dateParse = moment(row.CREATED_AT, "YYYY.MM.DD HH:mm");
                tempDate = dateParse.toDate();
                orderData[row.ORDER_ID]['time'] = tempDate;

                if (init) {
                    startDate = tempDate
                    endDate = tempDate
                    init = false
                }else {
                    if (tempDate < startDate)
                        startDate = tempDate
                    if (tempDate > endDate )
                        endDate = tempDate
                }

                if (row.RESTAURANT_ADDRESS_LAT != '-' && row.RESTAURANT_ADDRESS_LNG != '-') {
                    orderData[row.ORDER_ID]['storeLat'] = Number(row.RESTAURANT_ADDRESS_LAT);
                    orderData[row.ORDER_ID]['storeLng'] = Number(row.RESTAURANT_ADDRESS_LNG);
                }else{
                    orderData[row.ORDER_ID]['storeLat'] = Number(row.CUSTOMER_ADDRESS_LAT);
                    orderData[row.ORDER_ID]['storeLng'] = Number(row.CUSTOMER_ADDRESS_LNG);
                }

                if ([orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString() in storeList) {
                    storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()]["count"]++;
                    storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()]["uid"].push(row.UID);
                    // storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()]["avgDist"] += Number(row.DISTANCE);
                    storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()]["avgAmount"] += Number(row.AMOUNT);
                }else {
                    storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()] = {"uid":[row.UID], "latlng":[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']], "service":row.SERVICE_PROVIDER, "count":1, "avgDist":Number(row.DISTANCE), "avgAmount":Number(row.AMOUNT)}
                }

                if (row.UID in customerList) {
                    customerList[row.UID]["count"]++;
                    customerList[row.UID]["avgDist"] += Number(row.DISTANCE);
                    customerList[row.UID]["avgAmount"] += Number(row.AMOUNT);
                }else {
                    customerList[row.UID] = {"uid": row.UID, "name": row.DISPLAY_NAME, "count":1, "latlng":[row.CUSTOMER_ADDRESS_LAT, row.CUSTOMER_ADDRESS_LNG], "avgDist":Number(row.DISTANCE), "avgAmount":Number(row.AMOUNT)};
                }
            }
        })
        .on('end', () => {
            console.log('CSV file successfully processed');

            Object.keys(storeList).map(function(key) {
                storeList[key]["avgDist"] /= storeList[key]["count"]
                storeList[key]["avgAmount"] /= storeList[key]["count"]
                storeList[key]["avgDist"] = storeList[key]["avgDist"].toFixed(2)
                storeList[key]["avgAmount"] = storeList[key]["avgAmount"].toFixed(2)
                uniqueStore.push(storeList[key])
            })

            Object.keys(customerList).map(function(key) {
                customerList[key]["avgDist"] /= customerList[key]["count"]
                customerList[key]["avgAmount"] /= customerList[key]["count"]
                customerList[key]["avgDist"] = customerList[key]["avgDist"].toFixed(2)
                customerList[key]["avgAmount"] = customerList[key]["avgAmount"].toFixed(2)
                uniqueCustomer.push(customerList[key])
            })

            result["uniqueStore"] = uniqueStore;//storeList.filter( onlyUnique );
            result["orderData"] = orderData;
            result["uniqueCustomer"] = uniqueCustomer;
            result["timeline"] = {"startDate":startDate, "endDate":endDate};
            res.send(result);
        });
})

router.get('/order_mysql', function (req, res, next) {
    orderData = {};
    result = {};
    storeList = {};
    customerList = {};
    uniqueStore = [];
    uniqueCustomer = [];
    startDate = new Date();
    endDate = new Date();
    var init = true;
    tempData = new Date();


    mysqlDB.query('SELECT u.UID, u.NAME, u.SERVICE_PROVIDER_ID, u.AMOUNT, u.ORDER_DATE, u.ADDRESS as u_addr, u.USER_LATITUDE AS u_lat, u.USER_LONGITUDE AS u_lng, u.RESTAURANT_ADDRESS AS r_addr, u.RESTAURANT_LATITUDE AS r_lat, u.RESTAURANT_LONGITUDE AS r_lng FROM T_USERS_ORDER_INFO as u WHERE u.UID NOT IN (SELECT UID FROM T_EXCLUDED_MEMBER)', function (err, rows, fields) {
        if (!err) {
            console.log(fields);

            if(row.ORDER_ID != null) {
                orderData[row.ORDER_ID] = {};
                orderData[row.ORDER_ID]['userID'] = row.UID;
                orderData[row.ORDER_ID]['name'] = row.NAME;
                orderData[row.ORDER_ID]['amount'] = Number(row.AMOUNT);
                orderData[row.ORDER_ID]['service'] = row.p.service_provider_id;
                orderData[row.ORDER_ID]['address'] = row.r_addr;
                orderData[row.ORDER_ID]['customerLat'] = Number(row.u_lat);
                orderData[row.ORDER_ID]['customerLng'] = Number(row.u_lng);
                // orderData[row.ORDER_ID]['dist'] = Number(row.DISTANCE);

                var dateParse = moment(row.CREATED_AT, "YYYY.MM.DD HH:mm");
                tempDate = dateParse.toDate();
                orderData[row.ORDER_ID]['time'] = tempDate;

                if (init) {
                    startDate = tempDate
                    endDate = tempDate
                    init = false
                }else {
                    if (tempDate < startDate)
                        startDate = tempDate
                    if (tempDate > endDate )
                        endDate = tempDate
                }

                if (r_lat != '-' && r_lng != '-') {
                    orderData[row.ORDER_ID]['storeLat'] = Number(r_lat);
                    orderData[row.ORDER_ID]['storeLng'] = Number(r_lng);
                }else{
                    orderData[row.ORDER_ID]['storeLat'] = Number(row.u_lat);
                    orderData[row.ORDER_ID]['storeLng'] = Number(row.u_lng);
                }

                if ([orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString() in storeList) {
                    storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()]["count"]++;
                    storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()]["uid"].push(row.UID);
                    // storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()]["avgDist"] += Number(row.DISTANCE);
                    storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()]["avgAmount"] += Number(row.AMOUNT);
                }else {
                    storeList[[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']].toString()] = {"uid":[row.UID], "latlng":[orderData[row.ORDER_ID]['storeLat'], orderData[row.ORDER_ID]['storeLng']], "service":row.SERVICE_PROVIDER_id, "count":1,  "avgAmount":Number(row.AMOUNT)}
                }

                if (row.UID in customerList) {
                    customerList[row.UID]["count"]++;
                    customerList[row.UID]["avgAmount"] += Number(row.AMOUNT);
                }else {
                    customerList[row.UID] = {"uid": row.UID, "name": row.DISPLAY_NAME, "count":1, "latlng":[row.u_lat, row.u_lng],  "avgAmount":Number(row.AMOUNT)};
                }
            }
        } else {
            console.log('query error : ' + err);
            res.send(err);
        }
    }).on('end', () => {
        console.log('CSV file successfully processed');

        Object.keys(storeList).map(function(key) {
            storeList[key]["avgDist"] /= storeList[key]["count"]
            storeList[key]["avgAmount"] /= storeList[key]["count"]
            storeList[key]["avgDist"] = storeList[key]["avgDist"].toFixed(2)
            storeList[key]["avgAmount"] = storeList[key]["avgAmount"].toFixed(2)
            uniqueStore.push(storeList[key])
        })

        Object.keys(customerList).map(function(key) {
            customerList[key]["avgDist"] /= customerList[key]["count"]
            customerList[key]["avgAmount"] /= customerList[key]["count"]
            customerList[key]["avgDist"] = customerList[key]["avgDist"].toFixed(2)
            customerList[key]["avgAmount"] = customerList[key]["avgAmount"].toFixed(2)
            uniqueCustomer.push(customerList[key])
        })

        result["uniqueStore"] = uniqueStore;//storeList.filter( onlyUnique );
        result["orderData"] = orderData;
        result["uniqueCustomer"] = uniqueCustomer;
        result["timeline"] = {"startDate":startDate, "endDate":endDate};
        res.send(result);
    });
})

router.get('/network_mysql', function (req, res, next) {
    userData = {};
    friendList = {};
    networkData = {"node": [], "link": []};
    result = {};
    metaData = {};
    startDate = new Date();
    endDate = new Date();
    tempData = new Date();
    var init = true;

    mysqlDB.query('SELECT * FROM T_SOCIAL as r INNER JOIN T_ACCOUNT_INFO as a ON (r.UID = a.UID) WHERE a.UID NOT IN (SELECT UID FROM T_EXCLUDED_MEMBER)', function (err, rows, fields) {
        if (!err) {
            console.log(fields);

            rows.map(function (row) {
                userData[row.UID] = {};
                userData[row.UID]["name"] = row.DISPLAY_NAME;
                userData[row.UID]["email"] = row.EMAIL;
                userData[row.UID]["signUp"] = row.CREATED_AT;
                userData[row.UID]["friendNum"] = 0;
                userData[row.UID]["registerRoute"] = 0;
                userData[row.UID]["refereNum"] = 0;
                userData[row.UID]["parentInfo"] = "Root";

                var dateParse = moment(row.CREATED_AT, "YYYY.MM.DD HH:mm");
                tempDate = dateParse.toDate();

                if (init) {
                    startDate = tempDate
                    endDate = tempDate
                    init = false
                } else {
                    if (tempDate < startDate)
                        startDate = tempDate
                    if (tempDate > endDate)
                        endDate = tempDate
                }
            })
        } else {
            console.log('query error : ' + err);
            res.send(err);
        }
    }).on('end', () => {
        next();
    });
}, function (req, res, next) {
    var maxDepth = 0;
    mysqlDB.query('SELECT * FROM T_REWARD_REFERRAL_HISTORY as r INNER JOIN T_ACCOUNT_INFO as a ON (r.REFEREE_UID = a.UID) WHERE a.UID NOT IN (SELECT UID FROM T_EXCLUDED_MEMBER)', function (err, rows, fields) {
        if (!err) {
            console.log(fields);

            rows.map(function(row) {
                userData[row.REFEREE_UID]["parentInfo"] = row.REFERRER_UID;

                if (!(row.REFERRER_UID in friendList)) {
                    friendList[row.REFERRER_UID] = [];
                }

                friendList[row.REFERRER_UID].push({'friendID': row.REFEREE_UID});
                userData[row.REFERRER_UID]["refereNum"] ++;

                if (userData[row.REFERRER_UID]["registerRoute"]!=3) {
                    if (userData[row.REFERRER_UID]["registerRoute"] == 2)
                        userData[row.REFERRER_UID]["registerRoute"] = 3;
                    else
                        userData[row.REFERRER_UID]["registerRoute"] = 1;
                }

                if (userData[row.REFEREE_UID]["registerRoute"]!=3) {
                    if (userData[row.REFEREE_UID]["registerRoute"]==1)
                        userData[row.REFEREE_UID]["registerRoute"] = 3;
                    else
                        userData[row.REFEREE_UID]["registerRoute"] = 2;
                }
            })
        } else {
            console.log('query error : ' + err);
            res.send(err);
        }
    }).on('end', () => {
        var totalUser = 0;
        var referral = 0;
        var referrer = 0;
        var referree = 0;

        Object.keys(userData).map(function(key) {
            if(key!="undefined") {
                totalUser++;
                var myParent = userData[key].parentInfo;
                if (myParent == 'Root') {
                    if (userData[key]["refereNum"]>0) {
                        referral++;
                        referrer++;
                    }
                } else {
                    referral++;
                    if (userData[key]["refereNum"]>0) {
                        referrer++;
                        referree++;
                    } else
                        referree++;
                }

                var refereDepth = 0;
                while (myParent !== 'Root') {
                    myParent = userData[myParent].parentInfo;
                    refereDepth++
                }
                if (maxDepth<refereDepth)
                    maxDepth = refereDepth;

                networkData["node"].push({
                    "name": userData[key]["name"],
                    "id": key,
                    "refere_num": userData[key]["refereNum"],
                    "group": userData[key]["registerRoute"],
                    "depth": refereDepth
                });
            }
        })
        Object.keys(friendList).map(function(key) {
            friends = friendList[key]
            friends.map(function(myFriend){
                if (key in userData && myFriend.friendID in userData)
                    networkData["link"].push({"source": key, "target": myFriend.friendID, "value": myFriend.type});
            })
        })

        metaData = {"maxDepth": maxDepth, "totalUser": totalUser, "referral": referral, "referrer": referrer, "referree": referree, "startDate": startDate, "endDate": endDate};
        result["metaData"] = metaData;
        result["networkData"] = networkData;
        result["userData"] = userData;
        res.send(result);
    })
});


function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

module.exports = router;
