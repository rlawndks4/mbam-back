const schedule = require('node-schedule');
const { dbQueryList, insertQuery } = require('../query-util');
const { returnMoment } = require('../util');
const scheduleIndex = () => {
    schedule.scheduleJob('0 0/1 * * * *', async function () {
        let return_monent = returnMoment();
        try {

            let columns = [
                `pk`,
                `user_pk`,
                `daily_jump_count`,
                `jump_time_table`,
                `(SELECT COUNT(*) FROM jump_table WHERE shop_pk=shop_table.pk AND date>='${return_monent.substring(0, 10)} 00:00:00' AND shop_pk=shop_table.pk AND date<='${return_monent.substring(0, 10)} 23:59:59') AS use_jump_count`
            ]
            let shop_sql = `SELECT ${columns.join()} FROM shop_table WHERE status=1 `;
            shop_sql += ` AND daily_jump_count > 0 `;
            let shops = await dbQueryList(shop_sql);
            shops = shops?.result;
            for (var i = 0; i < shops.length; i++) {
                let time_table = JSON.parse(shops[i]?.jump_time_table ?? '[]');
                if (time_table.map(itm => { return itm?.time }).includes(return_monent.substring(11, 16))) {
                    let result = await insertQuery(`INSERT INTO jump_table (shop_pk, user_pk) VALUES (?, ?)`, [
                        shops[i]?.pk,
                        shops[i]?.user_pk,
                    ])
                }
            }
        } catch (err) {
            console.log(err);
        }
    })
}
module.exports = {
    scheduleIndex,
}
