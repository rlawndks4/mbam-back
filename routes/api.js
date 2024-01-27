const express = require('express')
require('dotenv');
//const { json } = require('body-parser')
const router = express.Router()
const cors = require('cors')
router.use(cors())
router.use(express.json())

const crypto = require('crypto')
//const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const when = require('when')
let iconv = require('iconv-lite');
const { checkLevel, getSQLnParams, getUserPKArrStrWithNewPK,
    isNotNullOrUndefined, namingImagesPath, nullResponse,
    lowLevelResponse, response, removeItems, returnMoment, formatPhoneNumber, categoryToNumber, sendAlarm, makeMaxPage, queryPromise, makeHash, commarNumber, getKewordListBySchema, listToObjKey,
    communityCategoryList
} = require('../util')
const {
    getRowsNumWithKeyword, getRowsNum, getAllDatas,
    getDatasWithKeywordAtPage, getDatasAtPage,
    getKioskList, getItemRows, getItemList, dbQueryList, dbQueryRows, insertQuery, getTableAI,
    getMultipleQueryByWhen
} = require('../query-util')
const macaddress = require('node-macaddress');
const fs = require('fs');
const db = require('../config/db')
const { upload } = require('../config/multerConfig')
const { Console, table } = require('console')
const { abort } = require('process')
const axios = require('axios')
//const { pbkdf2 } = require('crypto')
const salt = "435f5ef2ffb83a632c843926b35ae7855bc2520021a73a043db41670bfaeb722"
const saltRounds = 10
const pwBytes = 64
const jwtSecret = "djfudnsqlalfKeyFmfRkwu"
const { format, formatDistance, formatRelative, subDays } = require('date-fns')
const geolocation = require('geolocation')
const { sqlJoinFormat, listFormatBySchema, myItemSqlJoinFormat } = require('../format/formats')
const { param } = require('jquery')
const _ = require('lodash')
const kakaoOpt = {
    clientId: '4a8d167fa07331905094e19aafb2dc47',
    redirectUri: 'http://172.30.1.19:8001/api/kakao/callback',
};
const sharp = require('sharp');
const path = require('path');
router.get('/', (req, res) => {
    console.log("back-end initialized")
    res.send('back-end initialized')
});



const onSignUp = async (req, res) => {
    try {
        //logRequest(req)
        const id = req.body.id ?? "";
        let pw = req.body.pw ?? "";
        const name = req.body.name ?? "";
        const nickname = req.body.nickname ?? "";
        const phone = req.body.phone ?? "";
        const user_level = req.body.user_level ?? 0;
        const type_num = 0;
        //중복 체크 
        let sql = "SELECT * FROM user_table WHERE id=? OR nickname=? ";
        db.query(sql, [id, nickname, -10], async (err, result) => {
            if (result.length > 0) {
                let msg = "";
                let i = 0;
                for (i = 0; i < result.length; i++) {
                    if (result[i].id == id) {
                        msg = "아이디가 중복됩니다.";
                        break;
                    }
                    if (result[i].nickname == nickname) {
                        msg = "닉네임이 중복됩니다.";
                        break;
                    }
                    if (result[i].user_level == -10 && result[i].phone == phone) {
                        msg = "가입할 수 없습니다.";
                        break;
                    }
                }
                return response(req, res, -200, msg, [])

            } else {
                await db.query("SELECT * FROM user_table WHERE user_level=-10", async (err, result) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "비밀번호 암호화 도중 에러 발생", [])
                    } else {
                        if (result.map(item => item.phone).includes(phone)) {
                            return response(req, res, -100, "가입할 수 없는 전화번호 입니다.", [])
                        } else {
                            await crypto.pbkdf2(pw, salt, saltRounds, pwBytes, 'sha512', async (err, decoded) => {
                                // bcrypt.hash(pw, salt, async (err, hash) => {
                                let hash = decoded.toString('base64')
                                if (err) {
                                    console.log(err)
                                    return response(req, res, -200, "비밀번호 암호화 도중 에러 발생", [])
                                }

                                sql = 'INSERT INTO user_table (id, pw, name, nickname , phone, user_level, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
                                await db.query(sql, [id, hash, name, nickname, phone, user_level, type_num], async (err, result) => {

                                    if (err) {
                                        console.log(err)
                                        return response(req, res, -200, "회원 추가 실패", [])
                                    }
                                    else {
                                        return response(req, res, 200, "회원 추가 성공", [])
                                    }
                                })
                            })
                        }
                    }
                })

            }
        })

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onLoginById = async (req, res) => {
    try {
        let { id, pw } = req.body;
        db.query('SELECT * FROM user_table WHERE id=?', [id], async (err, result1) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result1.length > 0) {
                    await crypto.pbkdf2(pw, salt, saltRounds, pwBytes, 'sha512', async (err, decoded) => {
                        // bcrypt.hash(pw, salt, async (err, hash) => {
                        let hash = decoded.toString('base64');
                        if (hash == result1[0].pw) {
                            try {
                                const token = jwt.sign({
                                    pk: result1[0].pk,
                                    nickname: result1[0].nickname,
                                    id: result1[0].id,
                                    user_level: result1[0].user_level,
                                    phone: result1[0].phone,
                                    profile_img: result1[0].profile_img,
                                    type: result1[0].type
                                },
                                    jwtSecret,
                                    {
                                        expiresIn: '60000m',
                                        issuer: 'fori',
                                    });
                                res.cookie("token", token, {
                                    httpOnly: true,
                                    maxAge: 60 * 60 * 1000 * 10 * 10 * 10,
                                    //sameSite: 'none', 
                                    //secure: true 
                                });
                                db.query('UPDATE user_table SET last_login=? WHERE pk=?', [returnMoment(), result1[0].pk], (err, result) => {
                                    if (err) {
                                        console.log(err)
                                        return response(req, res, -200, "서버 에러 발생", [])
                                    }
                                })
                                return response(req, res, 200, result1[0].nickname + ' 님 환영합니다.', result1[0]);
                            } catch (e) {
                                console.log(e)
                                return response(req, res, -200, "서버 에러 발생", [])
                            }
                        } else {
                            return response(req, res, -100, "아이디 또는 비밀번호를 확인해주세요.", [])

                        }
                    })
                } else {
                    return response(req, res, -100, "아이디 또는 비밀번호를 확인해주세요.", [])
                }
            }
        })

    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onLoginBySns = (req, res) => {
    try {
        let { id, typeNum, name, nickname, phone, user_level, profile_img } = req.body;
        db.query("SELECT * FROM user_table WHERE id=? AND type=?", [id, typeNum], async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result.length > 0) {//기존유저
                    let token = jwt.sign({
                        pk: result[0].pk,
                        nickname: result[0].nickname,
                        id: result[0].id,
                        user_level: result[0].user_level,
                        phone: result[0].phone,
                        profile_img: result[0].profile_img,
                        type: typeNum
                    },
                        jwtSecret,
                        {
                            expiresIn: '6000m',
                            issuer: 'fori',
                        });
                    res.cookie("token", token, { httpOnly: true, maxAge: 60 * 60 * 1000 * 10 * 10 * 10 });
                    await db.query('UPDATE user_table SET last_login=? WHERE pk=?', [returnMoment(), result[0].pk], (err, result) => {
                        if (err) {
                            console.log(err)
                            return response(req, res, -200, "서버 에러 발생", [])
                        }
                    })
                    return response(req, res, 200, result[0].nickname + ' 님 환영합니다.', result[0]);
                } else {//신규유저
                    return response(req, res, 50, '신규회원 입니다.', []);
                }
            }
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}


const uploadProfile = (req, res) => {
    try {
        if (!req.file) {
            return response(req, res, 100, "success", [])
        }
        const image = (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req.file.fieldname + '/' + req.file.filename;
        const id = req.body.id;
        db.query('UPDATE user_table SET profile_img=? WHERE id=?', [image, id], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getMyInfo = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let result = await dbQueryList(`SELECT * FROM user_table WHERE pk=${decode?.pk}`);
        result = result?.result[0];
        return response(req, res, 100, "success", result);
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const editMyInfo = async (req, res) => {
    try {
        let { pw, nickname, newPw, phone, id, zip_code, address, address_detail, account_holder, bank_name, account_number, typeNum } = req.body;
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        if (decode?.id != id) {
            return response(req, res, -150, "잘못된 접근입니다.", [])
        }
        let user = await dbQueryList('SELECT * FROM user_table WHERE pk=?', [decode?.pk]);
        user = user?.result[0];
        pw = await makeHash(pw);
        pw = pw?.data;
        if (user?.pw != pw) {
            return response(req, res, -100, "비밀번호가 일치하지 않습니다.", [])
        }
        if (typeNum == 0) {
            let result = insertQuery("UPDATE user_table SET zip_code=?, address=?, address_detail=?, account_holder=?, bank_name=?, account_number=? WHERE pk=?", [zip_code, address, address_detail, account_holder, bank_name, account_number, decode?.pk]);
            return response(req, res, 100, "success", []);
        } else {

            if (newPw) {
                await crypto.pbkdf2(newPw, salt, saltRounds, pwBytes, 'sha512', async (err, decoded) => {
                    // bcrypt.hash(pw, salt, async (err, hash) => {
                    let new_hash = decoded.toString('base64')
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "새 비밀번호 암호화 도중 에러 발생", [])
                    }
                    await db.query("UPDATE user_table SET pw=? WHERE id=?", [new_hash, id], (err, result) => {
                        if (err) {
                            console.log(err)
                            return response(req, res, -100, "서버 에러 발생", []);
                        } else {
                            return response(req, res, 100, "success", []);
                        }
                    })
                })
            } else if (nickname || phone) {
                let selectSql = "";
                let updateSql = "";
                let zColumn = [];
                if (nickname) {
                    selectSql = "SELECT * FROM user_table WHERE nickname=? AND id!=?"
                    updateSql = "UPDATE user_table SET nickname=? WHERE id=?";
                    zColumn.push(nickname);
                } else if (phone) {
                    selectSql = "SELECT * FROM user_table WHERE phone=? AND id!=?"
                    updateSql = "UPDATE user_table SET phone=? WHERE id=?";
                    zColumn.push(phone);
                }
                zColumn.push(id);
                await db.query(selectSql, zColumn, async (err, result1) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -100, "서버 에러 발생", []);
                    } else {
                        if (result1.length > 0) {
                            let message = "";
                            if (nickname) {
                                message = "이미 사용중인 닉네임 입니다.";
                            } else if (phone) {
                                message = "이미 사용중인 전화번호 입니다.";
                            }
                            return response(req, res, -50, message, []);
                        } else {
                            await db.query(updateSql, zColumn, (err, result2) => {
                                if (err) {
                                    console.log(err)
                                    return response(req, res, -100, "서버 에러 발생", []);
                                } else {
                                    return response(req, res, 100, "success", []);
                                }
                            })
                        }
                    }
                })
            }
        }
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onResign = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let { pw } = req.body;
        pw = await makeHash(pw);
        pw = pw?.data;
        let user = await dbQueryList(`SELECT * FROM user_table WHERE pk=?`, [decode?.pk]);
        user = user?.result[0];
        if (pw != user?.pw) {
            return response(req, res, -100, "비밀번호가 일치하지 않습니다.", []);
        }
        db.query("DELETE FROM user_table WHERE pk=?", [decode?.pk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -100, "서버 에러 발생", []);
            } else {
                return response(req, res, 100, "success", []);
            }
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const kakaoCallBack = (req, res) => {
    try {
        const token = req.body.token;
        async function kakaoLogin() {
            let tmp;

            try {
                const url = 'https://kapi.kakao.com/v2/user/me';
                const Header = {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                };
                tmp = await axios.get(url, Header);
            } catch (e) {
                console.log(e);
                return response(req, res, -200, "서버 에러 발생", [])
            }

            try {
                const { data } = tmp;
                const { id, properties } = data;
                return response(req, res, 100, "success", { id, properties });

            } catch (e) {
                console.log(e);
                return response(req, res, -100, "서버 에러 발생", [])
            }

        }
        kakaoLogin();

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}



const sendAligoSms = ({ receivers, message }) => {
    return axios.post('https://apis.aligo.in/send/', null, {
        params: {
            key: 'xbyndmadqxp8cln66alygdq12mbpj7p7',
            user_id: 'firstpartner',
            sender: '1522-1233',
            receiver: receivers.join(','),
            msg: message
        },
    }).then((res) => res.data).catch(err => {
        console.log('err', err);
    });
}
const sendSms = (req, res) => {
    try {
        let receiver = req.body.receiver;
        const content = req.body.content;
        sendAligoSms({ receivers: receiver, message: content }).then((result) => {
            if (result.result_code == '1') {
                return response(req, res, 100, "success", [])
            } else {
                return response(req, res, -100, "fail", [])
            }
        });
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const findIdByPhone = (req, res) => {
    try {
        const phone = req.body.phone;
        const name = req.body.name;
        db.query("SELECT pk, id FROM user_table WHERE phone=? AND name=?", [phone, name], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", result[0])
            }
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const findAuthByIdAndPhone = (req, res) => {
    try {
        const id = req.body.id;
        const phone = req.body.phone;
        const name = req.body.name;
        db.query("SELECT * FROM user_table WHERE id=? AND phone=? AND name=?", [id, phone, name], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result.length > 0) {
                    return response(req, res, 100, "success", result[0]);
                } else {
                    return response(req, res, -50, "아이디 또는 비밀번호를 확인해주세요.", []);
                }
            }
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const checkExistId = (req, res) => {
    try {
        const id = req.body.id;
        db.query(`SELECT * FROM user_table WHERE id=? `, [id], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result.length > 0) {
                    return response(req, res, -50, "이미 사용중인 아이디입니다.", []);
                } else {
                    return response(req, res, 100, "사용가능한 아이디입니다.", []);
                }
            }
        })

    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const checkPassword = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let pw = req.body.pw;
        let user = await dbQueryList(`SELECT * FROM user_table WHERE pk=?`, [decode?.pk]);
        user = user?.result[0];

        pw = await makeHash(pw);
        pw = pw?.data;
        if (pw == user?.pw) {
            return response(req, res, 100, "success", [])
        } else {
            return response(req, res, -100, "비밀번호가 일치하지 않습니다.", [])
        }
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const checkExistIdByManager = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const id = req.body.id;
        db.query(`SELECT * FROM user_table WHERE id=? `, [id], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", result[0])
            }
        })

    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const checkExistNickname = (req, res) => {
    try {
        const nickname = req.body.nickname;
        db.query(`SELECT * FROM user_table WHERE nickname=? `, [nickname], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result.length > 0) {
                    return response(req, res, -50, "이미 사용중인 닉네임입니다.", []);
                } else {
                    return response(req, res, 100, "사용가능한 닉네임입니다.", []);
                }
            }
        })

    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const changePassword = (req, res) => {
    try {
        const id = req.body.id;
        let pw = req.body.pw;
        crypto.pbkdf2(pw, salt, saltRounds, pwBytes, 'sha512', async (err, decoded) => {
            // bcrypt.hash(pw, salt, async (err, hash) => {
            let hash = decoded.toString('base64')

            if (err) {
                console.log(err)
                return response(req, res, -200, "비밀번호 암호화 도중 에러 발생", [])
            }

            await db.query("UPDATE user_table SET pw=? WHERE id=?", [hash, id], (err, result) => {
                if (err) {
                    console.log(err)
                    return response(req, res, -200, "서버 에러 발생", [])
                } else {
                    return response(req, res, 100, "success", [])
                }
            })
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getUserToken = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (decode) {
            let pk = decode.pk;
            let nickname = decode.nickname;
            let id = decode.id;
            let phone = decode.phone;
            let user_level = decode.user_level;
            let profile_img = decode.profile_img;
            let type = decode.type;
            res.send({ id, pk, nickname, phone, user_level, profile_img, type })
        }
        else {
            res.send({
                pk: -1,
                level: -1
            })
        }
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onLogout = (req, res) => {
    try {
        res.clearCookie('token')
        //res.clearCookie('rtoken')
        return response(req, res, 200, "로그아웃 성공", [])
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getUsers = (req, res) => {
    try {
        let sql = "SELECT * FROM user_table ";
        let pageSql = "SELECT COUNT(*) FROM user_table ";
        let page_cut = req.query.page_cut;
        let status = req.query.status;
        let keyword = req.query.keyword;
        let userType = req.query.userType;
        let userLevel = req.query.userLevel;
        let whereStr = " WHERE 1=1 ";
        if (req.query.level) {
            if (req.query.level == 0) {
                whereStr += ` AND user_level <= ${req.query.level} `;
            } else {
                whereStr += ` AND user_level=${req.query.level} `;
            }
        }
        if (userType) {
            whereStr += ` AND type=${userType} `;
        }
        if (userLevel) {
            whereStr += ` AND user_level=${userLevel} `;
        }
        if (status) {
            whereStr += ` AND status=${status} `;
        }
        if (keyword) {
            whereStr += ` AND (id LIKE '%${keyword}%' OR name LIKE '%${keyword}%' OR nickname LIKE '%${keyword}%' OR phone LIKE '%${keyword}%')`;
        }
        if (!page_cut) {
            page_cut = 15
        }
        pageSql = pageSql + whereStr;
        sql = sql + whereStr + " ORDER BY sort DESC ";
        if (req.query.page) {
            sql += ` LIMIT ${(req.query.page - 1) * page_cut}, ${page_cut}`;
            db.query(pageSql, async (err, result1) => {
                if (err) {
                    console.log(err)
                    return response(req, res, -200, "서버 에러 발생", [])
                } else {
                    await db.query(sql, (err, result2) => {
                        if (err) {
                            console.log(err)
                            return response(req, res, -200, "서버 에러 발생", [])
                        } else {
                            let maxPage = result1[0]['COUNT(*)'] % page_cut == 0 ? (result1[0]['COUNT(*)'] / page_cut) : ((result1[0]['COUNT(*)'] - result1[0]['COUNT(*)'] % page_cut) / page_cut + 1);
                            return response(req, res, 100, "success", { data: result2, maxPage: maxPage });
                        }
                    })
                }
            })
        } else {
            db.query(sql, (err, result) => {
                if (err) {
                    console.log(err)
                    return response(req, res, -200, "서버 에러 발생", [])
                } else {
                    return response(req, res, 100, "success", result)
                }
            })
        }
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const updateUser = async (req, res) => {
    try {
        const id = req.body.id ?? "";
        let pw = req.body.pw ?? "";
        const name = req.body.name ?? "";
        const nickname = req.body.nickname ?? "";
        const phone = req.body.phone ?? "";

        const user_level = req.body.user_level ?? 0;

        const pk = req.body.pk ?? 0;
        if (pw) {
            await crypto.pbkdf2(pw, salt, saltRounds, pwBytes, 'sha512', async (err, decoded) => {
                // bcrypt.hash(pw, salt, async (err, hash) => {
                let hash = decoded.toString('base64')
                if (err) {
                    console.log(err)
                    return response(req, res, -200, "비밀번호 암호화 도중 에러 발생", [])
                } else {
                    await db.query("UPDATE user_table SET pw=? WHERE pk=?", [hash, pk], (err, result) => {
                        if (err) {
                            console.log(err)
                            return response(req, res, -200, "비밀번호 insert중 에러발생", [])
                        } else {
                        }
                    })
                }
            })
        }
        await db.query("UPDATE user_table SET id=?, name=?, nickname=?, phone=?, user_level=? WHERE pk=?", [id, name, nickname, phone, user_level, pk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버에러발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}



const getHomeContent = async (req, res) => {
    try {

        let return_monent = returnMoment();
        let result_list = [];

        let shop_column_list = [
            'shop_table.*',
            'city_table.name AS city_name',
            'sub_city_table.name AS sub_city_name',
            'shop_theme_table.name AS theme_name',
            `(SELECT COUNT(*) FROM comment_table WHERE shop_pk=shop_table.pk) AS comment_count`,
            `(SELECT COUNT(*) FROM shop_review_table WHERE shop_pk=shop_table.pk) AS review_count`,
        ]
        let shop_sql = `SELECT ${shop_column_list.join()} FROM shop_table `;
        let city_left_join_str = ` LEFT JOIN city_table ON shop_table.city_pk=city_table.pk  LEFT JOIN sub_city_table ON shop_table.sub_city_pk=sub_city_table.pk  `
        shop_sql += city_left_join_str;
        shop_sql += ` LEFT JOIN shop_theme_table ON shop_table.theme_pk=shop_theme_table.pk `;
        shop_sql += ` WHERE shop_table.status=1 `;
        shop_sql += ` ORDER BY sort DESC `;
        let sql_list = [
            { table: 'banner', sql: 'SELECT * FROM setting_table ORDER BY pk DESC LIMIT 1', type: 'obj' },
            { table: 'city', sql: 'SELECT * FROM city_table WHERE status=1 ORDER BY sort DESC', type: 'list' },
            { table: 'theme', sql: 'SELECT * FROM shop_theme_table WHERE status=1 ORDER BY sort DESC', type: 'list' },
            { table: 'notice', sql: 'SELECT * FROM notice_table WHERE status=1 ORDER BY sort DESC LIMIT 0, 5', type: 'list' },
            { table: 'blog', sql: 'SELECT * FROM blog_table WHERE status=1 ORDER BY sort DESC LIMIT 0, 5', type: 'list' },
            { table: 'shop_review', sql: 'SELECT * FROM shop_review_table WHERE status=1 ORDER BY sort DESC LIMIT 0, 5', type: 'list' },
            { table: 'freeboard', sql: 'SELECT * FROM freeboard_table WHERE status=1 ORDER BY sort DESC LIMIT 0, 5', type: 'list' },
            { table: 'greeting', sql: 'SELECT * FROM greeting_table WHERE status=1 ORDER BY sort DESC LIMIT 0, 5', type: 'list' },
            { table: 'shop', sql: shop_sql, type: 'list' },
            { table: 'jump', sql: `SELECT * FROM jump_table WHERE date>='${return_monent.substring(0, 10)} 00:00:00' AND date<='${return_monent.substring(0, 10)} 23:59:59' ORDER BY pk DESC `, type: 'list' },
            { table: 'real_time_shop', sql: `SELECT shop_table.pk, shop_table.name, real_time_rank, hot_place_rank, city_table.name AS city_name, sub_city_table.name AS sub_city_name FROM shop_table ${city_left_join_str} WHERE shop_table.status=1 AND real_time_rank > 0`, type: 'list' },
            { table: 'hop_place_shop', sql: `SELECT shop_table.pk, shop_table.name, real_time_rank, hot_place_rank, city_table.name AS city_name, sub_city_table.name AS sub_city_name FROM shop_table ${city_left_join_str} WHERE shop_table.status=1 AND hot_place_rank > 0`, type: 'list' },
        ];

        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result_obj = {};
        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i].table, sql_list[i].sql, sql_list[i].type));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result = (await when(result_list));
        for (var i = 0; i < (await result).length; i++) {
            result_obj[(await result[i])?.table] = (await result[i])?.data;
        }
        let country_list = await dbQueryList(`SELECT * FROM shop_country_table`);
        country_list = country_list?.result;
        let country_obj = listToObjKey(country_list, 'pk');
        let option_list = await dbQueryList(`SELECT * FROM shop_option_table`);
        option_list = option_list?.result;
        let option_obj = listToObjKey(option_list, 'pk');

        for (var i = 0; i < result_obj['shop'].length; i++) {
            result_obj['shop'][i]['country_list'] = JSON.parse(result_obj['shop'][i]['country_list']);
            for (var j = 0; j < result_obj['shop'][i]['country_list'].length; j++) {
                if (country_obj[result_obj['shop'][i]['country_list'][j]]) {
                    result_obj['shop'][i]['country_list'][j] = country_obj[result_obj['shop'][i]['country_list'][j]];
                }
            }
            result_obj['shop'][i]['option_list'] = JSON.parse(result_obj['shop'][i]['option_list']);
            for (var j = 0; j < result_obj['shop'][i]['option_list'].length; j++) {
                if (option_obj[result_obj['shop'][i]['option_list'][j]]) {
                    result_obj['shop'][i]['option_list'][j] = option_obj[result_obj['shop'][i]['option_list'][j]];
                }
            }
        }
        if (result_obj['shop'].length > 0) {
            let managers = await dbQueryList(`SELECT * FROM shop_manager_table WHERE shop_pk IN (${result_obj['shop'].map(itm => { return itm?.pk }).join()}) AND status=1`);
            managers = managers?.result;
            for (var i = 0; i < result_obj['shop'].length; i++) {
                result_obj['shop'][i].managers = managers.filter(el => el?.shop_pk == result_obj['shop'][i]?.pk);
            }
        }
        //jump
        let shop_list = [];
        let shop_pk_list = result_obj['shop'].map(itm => { return itm?.pk });
        for (var i = 0; i < result_obj['jump'].length; i++) {
            let shop_pk = result_obj['jump'][i]?.shop_pk;
            if (shop_pk_list.includes(shop_pk) && !_.find(shop_list, { pk: shop_pk })) {
                shop_list.push(_.find(shop_list, { pk: shop_pk }));
            }
        }
        for (var i = 0; i < result_obj['shop'].length; i++) {
            if (!_.find(shop_list, { pk: result_obj['shop'][i]?.pk })) {
                shop_list.push(result_obj['shop'][i]);
            }
        }
        result_obj['shop'] = shop_list;

        let real_time_shop_rand = await dbQueryList(`SELECT shop_table.pk, shop_table.name, real_time_rank, hot_place_rank, city_table.name AS city_name, sub_city_table.name AS sub_city_name FROM shop_table ${city_left_join_str} WHERE shop_table.status=1 ${result_obj['real_time_shop'].length > 0 ? `AND real_time_rank NOT IN (${result_obj['real_time_shop'].map(itm => { return itm?.pk }).join()})` : ''} ORDER BY RAND() LIMIT ${10 - result_obj['real_time_shop'].length}`);
        real_time_shop_rand = real_time_shop_rand?.result;
        let hop_place_shop_rand = await dbQueryList(`SELECT shop_table.pk, shop_table.name, real_time_rank, hot_place_rank, city_table.name AS city_name, sub_city_table.name AS sub_city_name FROM shop_table ${city_left_join_str} WHERE shop_table.status=1 ${result_obj['hop_place_shop'].length > 0 ? `AND hot_place_rank NOT IN (${result_obj['hop_place_shop'].map(itm => { return itm?.pk }).join()})` : ''} ORDER BY RAND() LIMIT ${20 - result_obj['hop_place_shop'].length}`);
        hop_place_shop_rand = hop_place_shop_rand?.result;

        let real_time_shop_list = [];
        let real_time_shop_rand_idx = 0;
        for (var i = 1; i <= 10; i++) {
            let find_idx = _.findIndex(result_obj['real_time_shop'], { real_time_rank: parseInt(i) });
            if (find_idx >= 0) {
                real_time_shop_list.push(result_obj['real_time_shop'][find_idx]);
            } else {
                if (real_time_shop_rand[real_time_shop_rand_idx]) {
                    real_time_shop_list.push(real_time_shop_rand[real_time_shop_rand_idx]);
                    real_time_shop_rand_idx++;
                } else {
                    break;
                }
            }
        }
        result_obj['real_time_shop'] = real_time_shop_list;

        let hop_place_shop_list = [];
        let hop_place_shop_rand_idx = 0;
        for (var i = 1; i <= 20; i++) {
            let find_idx = _.findIndex(result_obj['hop_place_shop'], { hot_place_rank: parseInt(i) });
            if (find_idx >= 0) {
                hop_place_shop_list.push(result_obj['hop_place_shop'][find_idx]);
            } else {
                if (hop_place_shop_rand[hop_place_shop_rand_idx]) {
                    hop_place_shop_list.push(hop_place_shop_rand[hop_place_shop_rand_idx]);
                    hop_place_shop_rand_idx++;
                } else {
                    break;
                }
            }
        }
        result_obj['hop_place_shop'] = hop_place_shop_list;

        return response(req, res, 100, "success", result_obj)

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getHeaderContent = async (req, res) => {
    try {

        const decode = checkLevel(req.cookies.token, 0)
        let result_list = [];
        let shop_columns = [
            `shop_table.*`,
            `(SELECT COUNT(*) FROM jump_table WHERE shop_pk=shop_table.pk AND date>='${returnMoment().substring(0, 10)} 00:00:00' AND shop_pk=shop_table.pk AND date<='${returnMoment().substring(0, 10)} 23:59:59') AS use_jump_count`
        ]
        let sql_list = [
            { table: 'top_banner', sql: 'SELECT * FROM setting_table ORDER BY pk DESC LIMIT 1', type: 'obj' },
            { table: 'popup', sql: 'SELECT * FROM popup_table WHERE status=1 ORDER BY sort DESC', type: 'list' },
            { table: 'theme', sql: 'SELECT * FROM shop_theme_table WHERE status=1 ORDER BY sort DESC', type: 'list' },
            { table: 'city', sql: 'SELECT * FROM city_table WHERE status=1 ORDER BY sort DESC', type: 'list' },
            { table: 'shop', sql: `SELECT ${shop_columns.join()} FROM shop_table WHERE user_pk=${decode?.pk ?? 0} ORDER BY pk DESC`, type: 'list' },
            // { table: 'master', sql: 'SELECT pk, nickname, name FROM user_table WHERE user_level=30 AND status=1  ORDER BY sort DESC', type: 'list' },
        ];
        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i]?.table, sql_list[i]?.sql));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result_obj = {};
        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i].table, sql_list[i].sql, sql_list[i].type));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result = (await when(result_list));
        for (var i = 0; i < (await result).length; i++) {
            result_obj[(await result[i])?.table] = (await result[i])?.data;
        }
        for (var i = 0; i < result_obj?.shop.length; i++) {
            delete result_obj.shop[i].note;
        }
        return response(req, res, 100, "success", result_obj)

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getMasterContent = async (req, res) => {
    try {
        let { pk, page, page_cut } = req.query;
        let master_content = undefined;
        page_cut = 4;
        if (page == 1) {
            master_content = await dbQueryList(`SELECT * FROM user_table WHERE pk=${pk}`);
            master_content = await master_content?.result[0];
        }
        let master_academies = await dbQueryList(`SELECT * FROM academy_category_table WHERE master_pk=${pk}`);
        master_academies = master_academies?.result;
        let master_academy_pk = [];
        for (var i = 0; i < master_academies.length; i++) {
            master_academy_pk.push(master_academies[i]?.pk);
        }
        let review_page = await dbQueryList(`SELECT COUNT(*) FROM review_table ${master_academy_pk.length > 0 ? `WHERE academy_category_pk IN (${master_academy_pk.join()})` : ` WHERE 1=2`}`);
        review_page = review_page?.result[0];
        review_page = review_page['COUNT(*)'] ?? 0;
        review_page = await makeMaxPage(review_page, page_cut);
        let review_sql = ` SELECT review_table.*,academy_category_table.main_img AS main_img, user_table.nickname AS nickname FROM review_table `;
        review_sql += ` LEFT JOIN academy_category_table ON review_table.academy_category_pk=academy_category_table.pk `;
        review_sql += ` LEFT JOIN user_table ON review_table.user_pk=user_table.pk `;
        review_sql += ` ${master_academy_pk.length > 0 ? `WHERE academy_category_pk IN (${master_academy_pk.join()})` : ` WHERE 1=2`} ORDER BY pk DESC LIMIT ${(page - 1) * page_cut}, ${page_cut} `;
        let review_list = await dbQueryList(review_sql);
        review_list = review_list?.result ?? [];
        return response(req, res, 100, "success", { maxPage: review_page, review_list: review_list, master_content: master_content, academy: master_academies });
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getReviewByMasterPk = async (req, res) => {
    try {
        let { pk, page, page_cut } = req.query;
        let master_content = undefined;
        let master_academies = undefined;
        let master_academy_pk = [];
        let review_page = undefined;
        let review_list = [];
        page_cut = 5;
        if (pk) {
            master_content = await dbQueryList(`SELECT * FROM user_table WHERE pk=${pk}`);
            master_content = await master_content?.result[0];
            master_academies = await dbQueryList(`SELECT * FROM academy_category_table WHERE master_pk=${pk}`);
            master_academies = master_academies?.result;
            master_academy_pk = [];
            for (var i = 0; i < master_academies.length; i++) {
                master_academy_pk.push(master_academies[i]?.pk);
            }
            review_page = await dbQueryList(`SELECT COUNT(*) FROM review_table ${master_academy_pk.length > 0 ? `WHERE academy_category_pk IN (${master_academy_pk.join()})` : `WHERE 1=2`}`);
            review_page = review_page?.result[0];
            review_page = review_page['COUNT(*)'] ?? 0;
            review_page = await makeMaxPage(review_page, page_cut);
            let sql = ` SELECT review_table.*,academy_category_table.main_img AS main_img, user_table.nickname AS nickname FROM review_table `;
            sql += ` LEFT JOIN academy_category_table ON review_table.academy_category_pk=academy_category_table.pk `;
            sql += `LEFT JOIN user_table ON review_table.user_pk=user_table.pk `;
            sql += ` ${master_academy_pk.length > 0 ? `WHERE academy_category_pk IN (${master_academy_pk.join()})` : `WHERE 1=2`} ORDER BY pk DESC LIMIT ${(page - 1) * page_cut}, ${page_cut} `
            review_list = await dbQueryList(sql);
            review_list = review_list?.result ?? [];
        } else {
            review_page = await dbQueryList(`SELECT COUNT(*) FROM review_table `);
            review_page = review_page?.result[0];
            review_page = review_page['COUNT(*)'] ?? 0;
            review_page = await makeMaxPage(review_page, page_cut);
            let sql = ` SELECT review_table.*,academy_category_table.main_img AS main_img, user_table.nickname AS nickname FROM review_table `;
            sql += `LEFT JOIN academy_category_table ON review_table.academy_category_pk=academy_category_table.pk `;
            sql += `LEFT JOIN user_table ON review_table.user_pk=user_table.pk `;
            sql += ` ORDER BY pk DESC LIMIT ${(page - 1) * page_cut}, ${page_cut} `;
            review_list = await dbQueryList(sql);
            review_list = review_list?.result ?? [];
        }
        return response(req, res, 100, "success", { maxPage: review_page, data: review_list });
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getVideo = (req, res) => {
    try {
        const pk = req.params.pk;
        let sql = `SELECT video_table.* , user_table.nickname, user_table.name FROM video_table LEFT JOIN user_table ON video_table.user_pk = user_table.pk WHERE video_table.pk=${pk} LIMIT 1`;
        db.query(sql, async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                let relate_video = JSON.parse(result[0].relate_video);
                relate_video = relate_video.join();
                await db.query(`SELECT title, date, pk FROM video_table WHERE pk IN (${relate_video})`, (err, result2) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "서버 에러 발생", [])
                    } else {
                        return response(req, res, 100, "success", { video: result[0], relate: result2 })
                    }
                })
            }
        })
        db.query(sql)
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getComments = (req, res) => {
    try {

        const { shop_pk, post_table, post_pk } = req.query;
        let zColumn = [];
        let columns = ""

        if (shop_pk) {
            zColumn.push(shop_pk)
            columns += " AND comment_table.shop_pk=? ";
        }
        if (post_table && post_pk) {
            zColumn.push(post_pk)
            zColumn.push(`${post_table}`)
            columns += " AND comment_table.post_pk=? AND post_table=? ";
        }
        db.query(`SELECT comment_table.*, user_table.nickname FROM comment_table LEFT JOIN user_table ON comment_table.user_pk = user_table.pk WHERE 1=1 ${columns} ORDER BY pk DESC`, zColumn, (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "fail", [])
            }
            else {
                return response(req, res, 200, "success", result)
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const addComment = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        let auth = {};
        if (!decode || decode?.user_level == -10) {
            return response(req, res, -150, "권한이 없습니다.", [])
        } else {
            auth = decode;

        }
        let { parentPk, note, shop_pk = 0, post_pk = 0, post_table = "", post_title = "" } = req.body;
        let userPk = auth.pk;
        let userNick = auth.nickname;
        db.query("INSERT INTO comment_table (user_pk, user_nickname, note, shop_pk, parent_pk, post_pk, post_table, post_title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [userPk, userNick, note, shop_pk, parentPk, post_pk, post_table, post_title], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "fail", [])
            }
            else {
                return response(req, res, 200, "success", [])
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateComment = (req, res) => {
    try {
        const { pk, note } = req.body;

        db.query("UPDATE comment_table SET note=? WHERE pk=?", [note, pk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "fail", [])
            }
            else {
                return response(req, res, 200, "success", [])
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getCommentsManager = (req, res) => {
    try {
        let sql = `SELECT COUNT(*) FROM comment_table `
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getKoreaByEng = (str) => {
    let ans = "";
    if (str == 'oneword') {
        ans = "하루1단어: ";
    } else if (str == 'oneevent') {
        ans = "하루1종목: ";
    } else if (str == 'theme') {
        ans = "핵심테마: ";
    } else if (str == 'strategy') {
        ans = "전문가칼럼: ";
    } else if (str == 'issue') {
        ans = "핵심이슈: ";
    } else if (str == 'feature') {
        ans = "특징주: ";
    }
    return ans;
}
const addItem = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let body = { ...req.body };
        delete body['table'];
        delete body['reason_correction'];
        delete body['manager_note'];
        let keys = Object.keys(body);
        let values = [];
        let values_str = "";

        for (var i = 0; i < keys.length; i++) {
            if (keys[i] == 'pw') {
                body[keys[i]] = await makeHash(body[keys[i]])?.data;
            }
            values.push(body[keys[i]]);
            if (i != 0) {
                values_str += ",";
            }
            values_str += " ?";
        }

        let files = { ...req.files };
        let files_keys = Object.keys(files);
        for (var i = 0; i < files_keys.length; i++) {
            values.push(
                (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req.files[files_keys][0].fieldname + '/' + req.files[files_keys][0].filename
            );
            keys.push('img_src');
            values_str += ", ?"
        }
        let table = req.body.table;
        let add_user_pk_list = [
            'notice',
            'faq',
            'event',
            'blog',
            'shop',
            'freeboard',
            'anonymous',
            'greeting',
            'education',
            'shop_offer',
            'shop_trade',
            'shop_event',
            'shop_review',
        ]
        if (add_user_pk_list.includes(table)) {
            keys.push('user_pk');
            values.push(decode?.pk);
            values_str += ", ?"
        }
        let sql = `INSERT INTO ${table}_table (${keys.join()}) VALUES (${values_str}) `;
        await db.beginTransaction();
        let result = await insertQuery(sql, values);
        let find_column = await insertQuery(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=? AND TABLE_SCHEMA=?`, [`${table}_table`, 'mbam']);
        find_column = find_column?.result;
        find_column = find_column.map((column) => {
            return column?.COLUMN_NAME
        })
        if (find_column.includes('sort')) {
            let result_ = await insertQuery(`UPDATE ${table}_table SET sort=? WHERE pk=?`, [result?.result?.insertId, result?.result?.insertId]);
        }
        let result2 = await updatePlusUtil(table, req.body);

        await db.commit();
        return response(req, res, 200, "success", []);

    } catch (err) {
        await db.rollback();
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const addItemByUserSettingBySchema = async (schema, keys_, values_str_, values_, body_) => {
    let body = body_;
    let keys = keys_;
    let values_str = values_str_;
    let values = values_;
    if (schema == 'review') {
        let class_item = await dbQueryList(`SELECT * FROM academy_category_table WHERE pk=?`, [body?.academy_category_pk]);
        class_item = class_item?.result[0];
        keys.push('master_pk');
        values_str += ", ?"
        values.push(class_item?.master_pk);
    }
    return {
        keys: keys,
        values_str: values_str,
        values: values,
    }
}
const addItemByUser = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let permission_schema = ['request', 'freeboard', 'question', 'humor', 'news', 'party', 'shop_review', 'shop_event', 'shop'];
        if (!permission_schema.includes(req.body.table)) {
            return response(req, res, -150, "잘못된 접근입니다.", [])
        }
        let body = { ...req.body };
        delete body['table'];
        delete body['reason_correction'];
        delete body['manager_note'];
        let keys = Object.keys(body);
        let values = [];
        let values_str = "";

        for (var i = 0; i < keys.length; i++) {
            if (keys[i] == 'pw') {
                body[keys[i]] = await makeHash(body[keys[i]])?.data;
            }
            values.push(body[keys[i]]);
            if (i != 0) {
                values_str += ",";
            }
            values_str += " ?";
        }

        let files = { ...req.files };
        let files_keys = Object.keys(files);
        for (var i = 0; i < files_keys.length; i++) {
            values.push(
                (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req.files[files_keys][0].fieldname + '/' + req.files[files_keys][0].filename
            );
            keys.push('img_src');
            values_str += ", ?"
        }
        let table = req.body.table;
        let use_user_pk = ['request', 'freeboard', 'question', 'humor', 'news', 'party', 'shop_review', 'shop_event', 'shop'];
        if (use_user_pk.includes(table)) {
            keys.push('user_pk');
            values.push(decode?.pk);
            values_str += ", ?"
        }
        let setting = await addItemByUserSettingBySchema(table, keys, values_str, values, body);

        keys = setting?.keys;
        values_str = setting?.values_str;
        values = setting?.values;
        let sql = `INSERT INTO ${table}_table (${keys.join()}) VALUES (${values_str}) `;
        await db.beginTransaction();
        let result = await insertQuery(sql, values);

        //let result2 = await insertQuery(`UPDATE ${table}_table SET sort=? WHERE pk=?`, [result?.result?.insertId, result?.result?.insertId]);

        await db.commit();
        return response(req, res, 200, "success", []);

    } catch (err) {
        await db.rollback();
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateItem = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let body = { ...req.body };
        let use_manager_pk = ['request'];
        delete body['table'];
        delete body['pk'];
        delete body['hash_list'];
        delete body['reason_correction'];
        delete body['manager_note'];
        let keys = Object.keys(body);
        let values = [];
        let values_str = "";
        if (req.body.hash_list && req.body.hash_list?.length > 0) {
            for (var i = 0; i < req.body.hash_list?.length; i++) {
                let hash_result = await makeHash(body[req.body.hash_list[i]]);
                if (!hash_result) {
                    return response(req, res, -100, "fail", [])
                } else {
                    body[req.body.hash_list[i]] = hash_result?.data;
                }
            }
        }

        for (var i = 0; i < keys.length; i++) {
            if (keys[i] == 'pw' && body[keys[i]]) {
                body[keys[i]] = await makeHash(body[keys[i]]);
            }
            values.push(body[keys[i]]);
            if (i != 0) {
                values_str += ",";
            }
            values_str += " ?";
        }

        let files = { ...req.files };
        let files_keys = Object.keys(files);
        for (var i = 0; i < files_keys.length; i++) {
            values.push(
                (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req.files[files_keys][0].fieldname + '/' + req.files[files_keys][0].filename
            );
            keys.push('img_src');
            values_str += ", ?"
        }
        let table = req.body.table;
        if (use_manager_pk.includes(table)) {
            values.push(decode?.pk);
            if (i != 0) {
                values_str += ",";
            }
            keys.push('manager_pk');
            values_str += " ?";
        }
        let sql = `UPDATE ${table}_table SET ${keys.join("=?,")}=? WHERE pk=?`;
        values.push(req.body.pk);
        await db.beginTransaction();
        let result = await insertQuery(sql, values);
        let result2 = await updatePlusUtil(table, req.body);
        await db.commit();
        return response(req, res, 200, "success", []);

    } catch (err) {
        console.log(err)
        await db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updatePlusUtil = async (schema, body) => {

    return;
    if (schema == 'shop') {
        let url = 'https://msgbam.com';
        let themes = await dbQueryList("SELECT * FROM shop_theme_table WHERE status=1");
        themes = themes?.result;
        let shops = await dbQueryList("SELECT city_1, city_2, pk FROM shop_table WHERE status=1");
        shops = shops?.result;
        let data = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        data += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`
        data += `<url><loc>${url}</loc><lastmod>${returnMoment().substring(0, 10)}</lastmod>\n</url>\n`
        let default_list = ['https://msgbam.com/community-list/freeboard/',
            'https://msgbam.com/community-list/question/',
            'https://msgbam.com/community-list/humor/',
            'https://msgbam.com/community-list/news/',
            'https://msgbam.com/community-list/party/',
            'https://msgbam.com/community-list/shop_review/',
            'https://msgbam.com/community-list/shop_event/',
            'https://msgbam.com/community-list/notice/',
            'https://msgbam.com/community-list/faq/',
            'https://msgbam.com/community-list/request/',];
        for (var i = 0; i < default_list.length; i++) {
            let string = `<url>\n<loc>${default_list[i]}`;
            string += `</loc>\n`;
            string += `<lastmod>${returnMoment().substring(0, 10)}</lastmod>\n`;
            string += `</url>\n`;
            data += string;
        }
        for (var i = 0; i < themes.length; i++) {
            let string = `<url>\n<loc>${url}/shop-list`;
            string += `/?theme=${themes[i]?.pk}`;
            string += `</loc>\n`;
            string += `<lastmod>${returnMoment().substring(0, 10)}</lastmod>\n`;
            string += `</url>\n`;
            data += string;
        }
        for (var i = 0; i < shops.length; i++) {
            let string = `<url>\n<loc>${url}/shop`;
            string += `/${shops[i]?.pk}`;
            string += `</loc>\n`;
            string += `<lastmod>${returnMoment().substring(0, 10)}</lastmod>\n`;
            string += `</url>\n`;
            data += string;
        }
        let post_sql_list = [];
        for (var i = 0; i < communityCategoryList.length - 1; i++) {
            post_sql_list.push({
                table: communityCategoryList[i].table,
                sql: `SELECT pk, title FROM ${communityCategoryList[i].table}_table WHERE status=1 `,
            })
        }
        let post_data = await getMultipleQueryByWhen(post_sql_list)
        for (var i = 0; i < Object.keys(post_data).length; i++) {
            let table = Object.keys(post_data)[i];
            for (var j = 0; j < post_data[table].length; j++) {
                let string = `<url>\n<loc>${url}/post`;
                string += `/${table}`;
                string += `/${post_data[table][j]?.pk}`;
                string += `</loc>\n`;
                string += `<lastmod>${returnMoment().substring(0, 10)}</lastmod>\n`;
                string += `</url>\n`;
                data += string;
            }
        }
        data += `</urlset>`;
        fs.writeFileSync('../user_front/public/sitemap.xml', data, 'utf8', function (error) {
            console.log('write end')
        });
    }
}

const addPopup = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 25)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const { link } = req.body;
        let image = "";
        if (req.file) {
            image = (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req.file.fieldname + '/' + req.file.filename;
        }
        db.query("INSERT INTO popup_table (link,img_src) VALUES (?,?)", [link, image], async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", []);
            } else {
                await db.query("UPDATE popup_table SET sort=? WHERE pk=?", [result?.insertId, result?.insertId], (err, resultup) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "fail", [])
                    }
                    else {
                        return response(req, res, 200, "success", [])
                    }
                })
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updatePopup = (req, res) => {
    try {
        const { link, pk } = req.body;
        let zColumn = [link];
        let columns = " link=?";
        let image = "";
        if (req.file) {
            image = (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req.file.fieldname + '/' + req.file.filename;
            zColumn.push(image);
            columns += ', main_img=? '
        }
        zColumn.push(pk)
        db.query(`UPDATE popup_table SET ${columns} WHERE pk=?`, zColumn, (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", []);
            } else {
                return response(req, res, 100, "success", []);
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const addNoteImage = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 25)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        if (req.file) {
            return response(req, res, 100, "success", { filename: `/image/note/${req.file.filename}` })
        } else {
            return response(req, res, -100, "이미지가 비어 있습니다.", [])
        }
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", []);
    }
}
const addImageItems = async (req, res) => {
    try {
        let files = { ...req.files };
        let files_keys = Object.keys(files);
        let result = [];
        for (var i = 0; i < files_keys.length; i++) {
            let file_name = (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req.files[files_keys[i]][0].fieldname + '/' + req.files[files_keys[i]][0].filename;
            result.push({
                key: files_keys[i],
                filename: file_name
            })
        }
        return response(req, res, 100, "success", result);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", []);
    }
}

const onSearchAllItem = async (req, res) => {
    try {
        let keyword = req.query.keyword;

        let sql_list = [];
        let sql_obj = [{ table: 'oneword', column: ['pk', 'title', 'hash'], wheres: ['title', 'hash', 'note'] },
        { table: 'oneevent', column: ['pk', 'title', 'hash'], wheres: ['title', 'hash', 'note'] },
        { table: 'issue', column: ['pk', 'title', 'hash', 'main_img', 'font_color', 'background_color', 'date'], wheres: ['title', 'hash', 'note'] },
        { table: 'feature', column: ['pk', 'title', 'hash', 'main_img', 'font_color', 'background_color', 'date'], wheres: ['title', 'hash', 'note'] },
        { table: 'theme', column: ['pk', 'title', 'hash', 'main_img', 'font_color', 'background_color', 'date'], wheres: ['title', 'hash', 'note'] },
        { table: 'video', column: ['pk', 'title', 'font_color', 'background_color', 'link'], wheres: ['title', 'note'] },
        ]
        for (var i = 0; i < sql_obj.length; i++) {
            let sql = "";
            sql = `SELECT ${sql_obj[i].column.join()} FROM ${sql_obj[i].table}_table WHERE status=1 AND (`;
            for (var j = 0; j < sql_obj[i].wheres.length; j++) {
                if (j != 0) {
                    sql += ` OR `
                }
                sql += ` ${sql_obj[i].wheres[j]} LIKE "%${keyword}%" `
            }
            sql += `) ORDER BY sort DESC LIMIT 8 `;

            sql_list.push(queryPromise(sql_obj[i].table, sql));
        }
        for (var i = 0; i < sql_list.length; i++) {
            await sql_list[i];
        }
        let result = (await when(sql_list));
        return response(req, res, 100, "success", { oneWord: (await result[0])?.data ?? [], oneEvent: (await result[1])?.data ?? [], issues: (await result[2])?.data ?? [], features: (await result[3])?.data ?? [], themes: (await result[4])?.data ?? [], videos: (await result[5])?.data ?? [] });


    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getAllPosts = async (req, res) => {
    try {
        let { keyword, page, order, page_cut } = req.query;
        if (!page_cut) {
            page_cut = 15;
        }
        let sql_list = [];
        let sql_obj = [
            { table: 'oneword', category_num: 0 },
            { table: 'oneevent', category_num: 1 },
            { table: 'theme', category_num: 2 },
            { table: 'strategy', category_num: 3 },
            { table: 'issue', category_num: 4 },
            { table: 'feature', category_num: 5 },
            { table: 'video', category_num: 6 },
            { table: 'notice', category_num: 7 },
        ]
        for (var i = 0; i < sql_obj.length; i++) {
            let sql = "";
            sql = `SELECT ${sql_obj[i].table}_table.title, ${sql_obj[i].table}_table.date, ${sql_obj[i].table}_table.views, '${sql_obj[i].table}' AS category, (SELECT COUNT(*)  FROM comment_table WHERE comment_table.item_pk=${sql_obj[i].table}_table.pk AND comment_table.category_pk=${sql_obj[i].category_num}) AS comment_num, user_table.nickname FROM ${sql_obj[i].table}_table LEFT JOIN user_table ON ${sql_obj[i].table}_table.user_pk=user_table.pk `;
            if (keyword) {
                sql += ` WHERE (${sql_obj[i].table}_table.title LIKE "%${keyword}%" OR user_table.nickname LIKE "%${keyword}%")`;
            }

            sql_list.push(queryPromise(sql_obj[i].table, sql));
        }
        for (var i = 0; i < sql_list.length; i++) {
            await sql_list[i];
        }
        let result_ = (await when(sql_list));
        let result = [];
        for (var i = 0; i < result_.length; i++) {
            result = [...result, ...(await result_[i])?.data ?? []];
        }

        result = await result.sort(function (a, b) {
            let x = a.date.toLowerCase();
            let y = b.date.toLowerCase();
            if (x > y) {
                return -1;
            }
            if (x < y) {
                return 1;
            }
            return 0;
        });
        let maxPage = makeMaxPage(result.length, page_cut);
        let result_obj = {};
        if (page) {
            result = result.slice((page - 1) * page_cut, (page) * page_cut)
            result_obj = { data: result, maxPage: maxPage };
        } else {
            result_obj = result;
        }
        return response(req, res, 100, "success", result_obj);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
function getDateRangeData(param1, param2) {  //param1은 시작일, param2는 종료일이다.
    var res_day = [];
    var ss_day = new Date(param1);
    var ee_day = new Date(param2);
    var _mon_ = (ss_day.getMonth() + 1);
    var month = _mon_ < 10 ? '0' + _mon_ : _mon_;
    while (ss_day.getTime() <= ee_day.getTime()) {
        var _mon_ = (ss_day.getMonth() + 1);
        _mon_ = _mon_ < 10 ? '0' + _mon_ : _mon_;
        var _day_ = ss_day.getDate();
        _day_ = _day_ < 10 ? '0' + _day_ : _day_;
        let current_flag = ss_day.getFullYear() + '-' + _mon_ + '-' + _day_ <= returnMoment().substring(0, 10);
        if (month == _mon_ && current_flag) {
            res_day.push(ss_day.getFullYear() + '-' + _mon_ + '-' + _day_);
        }
        ss_day.setDate(ss_day.getDate() + 1);
    }
    return res_day;
}
const getUserStatistics = async (req, res) => {
    try {
        let { page, page_cut, year, month, type } = req.query;
        if (!page_cut) {
            page_cut = 15;
        }
        let dates = [];
        let format = '';
        if (type == 'month') {
            let last_month = 0;
            if (returnMoment().substring(0, 4) == year) {
                last_month = parseInt(returnMoment().substring(5, 7));
            } else {
                last_month = 12;
            }
            for (var i = 1; i <= last_month; i++) {
                dates.push(`${year}-${i < 10 ? `0${i}` : i}`);
            }
            format = '%Y-%m';
        } else {

            dates = getDateRangeData(new Date(`${year}-${month < 10 ? `0${month}` : `${month}`}-01`), new Date(`${year}-${month < 10 ? `0${month}` : `${month}`}-31`));
            format = '%Y-%m-%d';
        }
        dates = dates.reverse();
        let date_index_obj = {};
        for (var i = 0; i < dates.length; i++) {
            date_index_obj[dates[i]] = i;
        }
        let sql_list = [];
        let sql_obj = [
            { table: 'user', date_colomn: 'user_date', count_column: 'user_count' },
            { table: 'oneword', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'oneevent', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'theme', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'strategy', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'issue', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'feature', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'video', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'notice', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'comment', date_colomn: 'comment_date', count_column: 'comment_count' },
        ]
        let subStr = ``;
        if (type == 'day') {
            subStr = ` WHERE SUBSTR(DATE, 1, 7)='${year + `-${month < 10 ? `0${month}` : month}`}' `;
        } else if (type == 'month') {
            subStr = ` WHERE SUBSTR(DATE, 1, 4)='${year}' `;
        } else {
            return response(req, res, -100, "fail", [])
        }
        for (var i = 0; i < sql_obj.length; i++) {
            let sql = "";

            sql = `SELECT DATE_FORMAT(date, '${format}') AS ${sql_obj[i].date_colomn}, COUNT(DATE_FORMAT(date, '${format}')) AS ${sql_obj[i].count_column} FROM ${sql_obj[i].table}_table ${subStr} GROUP BY DATE_FORMAT(date, '${format}') ORDER BY ${sql_obj[i].date_colomn} DESC`;
            sql_list.push(queryPromise(sql_obj[i].table, sql));
        }
        for (var i = 0; i < sql_list.length; i++) {
            await sql_list[i];
        }
        let result = (await when(sql_list));
        let result_list = [];
        for (var i = 0; i < dates.length; i++) {
            result_list.push({
                date: dates[i],
                user_count: 0,
                visit_count: 0,
                post_count: 0,
                comment_count: 0,
                views_count: 0
            })
        }

        for (var i = 0; i < result.length; i++) {
            let date_column = ``;
            let count_column = ``;
            if ((await result[i])?.table == 'user') {
                date_column = `user_date`;
                count_column = `user_count`;
            } else if ((await result[i])?.table == 'comment') {
                date_column = `comment_date`;
                count_column = `comment_count`;
            } else if ((await result[i])?.table == 'views') {
                date_column = `views_date`;
                count_column = `views_count`;
            } else if ((await result[i])?.table == 'visit') {
                date_column = `visit_date`;
                count_column = `visit_count`;
            } else {
                date_column = `post_date`;
                count_column = `post_count`;
            }
            let data_list = (await result[i])?.data;
            if (data_list.length > 0) {
                for (var j = 0; j < data_list.length; j++) {
                    result_list[date_index_obj[data_list[j][date_column]]][count_column] += data_list[j][count_column]
                }
            }

        }
        let maxPage = makeMaxPage(result_list.length, page_cut);
        let result_obj = {};
        if (page) {
            result_list = result_list.slice((page - 1) * page_cut, (page) * page_cut)
            result_obj = { data: result_list, maxPage: maxPage };
        } else {
            result_obj = result_list;
        }
        return response(req, res, 100, "success", result_obj);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", []);
    }
}
const itemCount = (req, res) => {
    try {
        const { table } = req.query;
        db.query(`SELECT COUNT(*) AS count FROM ${table}_table`, (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", result[0])
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getOptionObjBySchema = async (schema, whereStr) => {
    let obj = {};
    if (schema == 'subscribe') {
        let sql = ` ${sqlJoinFormat(schema, ``, "", `SELECT COUNT(*) AS people_num, SUM(${schema}_table.price) AS sum_price FROM ${schema}_table `)?.page_sql} ${whereStr} AND ${schema}_table.transaction_status >= 0`;
        let option = await dbQueryList(sql);
        option = option?.result[0];
        let sql2 = ` ${sqlJoinFormat(schema, ``, "", `SELECT COUNT(*) AS people_num, SUM(${schema}_table.price) AS sum_price FROM ${schema}_table `)?.page_sql} ${whereStr} AND ${schema}_table.transaction_status < 0 `;
        let cancel_people = await dbQueryList(sql2);
        cancel_people = cancel_people?.result[0];
        obj = {
            people_num: { title: '총 수강인원', content: commarNumber(((option?.people_num ?? 0) - (cancel_people?.people_num ?? 0))) },
        }
        if (!whereStr.includes('status=0')) {
            obj.sum_price = { title: '총 결제금액', content: commarNumber(((option?.sum_price ?? 0) + (cancel_people?.sum_price ?? 0))) }
        }
    }
    return obj;
}
const getShops = async (req, res) => {
    try {
        let return_monent = returnMoment();
        let { theme = 0, is_around, city = 0, sub_city = 0, keyword } = req.body;
        let column_list = [
            'shop_table.*',
            'city_table.name AS city_name',
            'sub_city_table.name AS sub_city_name',
            'sub_city_table.name AS sub_city_name',
            'shop_theme_table.name AS theme_name',
            `(SELECT COUNT(*) FROM comment_table WHERE shop_pk=shop_table.pk) AS comment_count`,
            `(SELECT COUNT(*) FROM shop_review_table WHERE shop_pk=shop_table.pk) AS review_count`,
            `(SELECT COUNT(*) FROM shop_manager_table WHERE shop_pk=shop_table.pk) AS manager_count`,
        ]
        let sql = `SELECT ${column_list.join()} FROM shop_table `;
        sql += ` LEFT JOIN city_table ON shop_table.city_pk=city_table.pk `;
        sql += ` LEFT JOIN sub_city_table ON shop_table.sub_city_pk=sub_city_table.pk `;
        sql += ` LEFT JOIN shop_theme_table ON shop_table.theme_pk=shop_theme_table.pk `;
        sql += ` WHERE shop_table.status=1 `;

        if (theme && theme != 0) {
            sql += ` AND theme_pk=${theme} `;
        }
        if (city && city != 0) {
            sql += ` AND shop_table.city_pk=${city} `;
        }
        if (sub_city && sub_city != 0) {
            sql += ` AND shop_table.sub_city_pk=${sub_city} `;
        }
        if (keyword) {
            let keyword_list = ['shop_table.name', 'shop_table.sub_name', 'city_table.name'];
            sql += ` AND ${keyword_list.join(` LIKE '%${keyword}%' OR `)} LIKE '%${keyword}%' `
        }

        let jump_list = await dbQueryList(`SELECT * FROM jump_table WHERE date>='${return_monent.substring(0, 10)} 00:00:00' AND date<='${return_monent.substring(0, 10)} 23:59:59' ORDER BY pk DESC `);
        jump_list = jump_list?.result;

        let country_list = await dbQueryList(`SELECT * FROM shop_country_table`);
        country_list = country_list?.result;
        let country_obj = listToObjKey(country_list, 'pk');
        let option_list = await dbQueryList(`SELECT * FROM shop_option_table`);
        option_list = option_list?.result;


        let option_obj = listToObjKey(option_list, 'pk');

        sql += ` ORDER BY sort `;
        let shops = await dbQueryList(sql);
        shops = shops?.result;
        for (var i = 0; i < shops.length; i++) {
            delete shops[i].note;
            shops[i]['country_list'] = JSON.parse(shops[i]['country_list']);
            shops[i]['price_list'] = JSON.parse(shops[i]['price_list']);
            for (var j = 0; j < shops[i]['country_list'].length; j++) {
                if (country_obj[shops[i]['country_list'][j]]) {
                    shops[i]['country_list'][j] = country_obj[shops[i]['country_list'][j]];
                }
            }
            shops[i]['option_list'] = JSON.parse(shops[i]['option_list']);
            for (var j = 0; j < shops[i]['option_list'].length; j++) {
                if (option_obj[shops[i]['option_list'][j]]) {
                    shops[i]['option_list'][j] = option_obj[shops[i]['option_list'][j]];
                }
            }
        }
        if (shops.length > 0) {
            let managers = await dbQueryList(`SELECT * FROM shop_manager_table WHERE shop_pk IN (${shops.map(itm => { return itm?.pk }).join()}) AND status=1`);
            managers = managers?.result;
            for (var i = 0; i < shops.length; i++) {
                shops[i].managers = managers.filter(el => el?.shop_pk == shops[i]?.pk);
            }
        }

        let shop_list = [];
        let shop_pk_list = shops.map(itm => { return itm?.pk });
        for (var i = 0; i < jump_list.length; i++) {
            let shop_pk = jump_list[i]?.shop_pk;
            if (shop_pk_list.includes(shop_pk) && !_.find(shop_list, { pk: shop_pk })) {
                shop_list.push(_.find(shop_list, { pk: shop_pk }));
            }
        }
        for (var i = 0; i < shops.length; i++) {
            if (!_.find(shop_list, { pk: shops[i]?.pk })) {
                shop_list.push(shops[i]);
            }
        }
        shops = shop_list;

        return response(req, res, 100, "success", shops);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getShop = async (req, res) => {
    try {
        let { pk, name, review_page, event_page } = req.body;
        let page_cut = 10;
        let result_list = [];
        if (!pk && !name) {
            return response(req, res, -404, "잘못된 접근입니다.", [])
        }
        if (!pk && name) {
            let shop = await dbQueryList(`SELECT * FROM shop_table WHERE name='${name}'`);
            shop = shop?.result[0];
            if (!shop) {
                return response(req, res, -404, "잘못된 접근입니다.", [])
            } else {
                pk = shop?.pk;
            }
        }
        let sql_list = [
            { table: 'shop', sql: `SELECT * FROM shop_table WHERE pk=${pk}`, type: 'obj' },
            { table: 'shop_manager', sql: `SELECT shop_manager_table.* FROM shop_manager_table LEFT JOIN shop_table ON shop_manager_table.shop_pk=shop_table.pk WHERE shop_manager_table.status=1 AND shop_manager_table.shop_pk=${pk} ORDER BY sort DESC `, type: 'list' },
            { table: 'review', sql: `SELECT shop_review_table.*, user_table.nickname FROM shop_review_table LEFT JOIN user_table ON shop_review_table.user_pk=user_table.pk WHERE status=1 AND shop_pk=${pk} ORDER BY pk DESC LIMIT ${(review_page - 1) * page_cut}, ${page_cut}`, type: 'list' },
            { table: 'review_size', sql: `SELECT COUNT(*) AS size FROM shop_review_table WHERE status=1 AND shop_pk=${pk}`, type: 'obj' },
            { table: 'event', sql: `SELECT shop_event_table.*, user_table.nickname FROM shop_event_table LEFT JOIN user_table ON shop_event_table.user_pk=user_table.pk WHERE status=1 AND shop_pk=${pk} ORDER BY pk DESC LIMIT ${(event_page - 1) * page_cut}, ${page_cut}`, type: 'list' },
            { table: 'event_size', sql: `SELECT COUNT(*) AS size FROM shop_event_table WHERE status=1 AND shop_pk=${pk}`, type: 'obj' },
        ];
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result_obj = {};
        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i].table, sql_list[i].sql, sql_list[i].type));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result = (await when(result_list));
        for (var i = 0; i < (await result).length; i++) {
            result_obj[(await result[i])?.table] = (await result[i])?.data;
        }
        let option_list = await dbQueryList(`SELECT * FROM shop_option_table`);
        option_list = option_list?.result;
        let option_obj = listToObjKey(option_list, 'pk');
        let country_list = await dbQueryList(`SELECT * FROM shop_country_table`);
        country_list = country_list?.result;
        let country_obj = listToObjKey(country_list, 'pk');
        result_obj['shop']['price_list'] = JSON.parse(result_obj['shop']['price_list'] ?? '[]');
        result_obj['shop']['option_list'] = JSON.parse(result_obj['shop']['option_list'] ?? '[]');
        result_obj['shop']['country_list'] = JSON.parse(result_obj['shop']['country_list'] ?? '[]');

        for (var i = 0; i < result_obj['shop']['option_list'].length; i++) {
            result_obj['shop']['option_list'][i] = option_obj[result_obj['shop']['option_list'][i]];
        }
        for (var i = 0; i < result_obj['shop']['country_list'].length; i++) {
            result_obj['shop']['country_list'][i] = country_obj[result_obj['shop']['country_list'][i]];
        }
        return response(req, res, 100, "success", result_obj)

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getItems = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)

        let { level, category_pk, status, user_pk, keyword, limit, page, page_cut, order, table, master_pk, difficulty, academy_category_pk, price_is_minus, start_date, end_date, type, city_pk, shop_pk, comment_type } = (req.query.table ? { ...req.query } : undefined) || (req.body.table ? { ...req.body } : undefined);;
        let sql = `SELECT * FROM ${table}_table `;
        let pageSql = `SELECT COUNT(*) FROM ${table}_table `;
        let keyword_columns = getKewordListBySchema(table);
        let whereStr = " WHERE 1=1 ";
        if (level) {
            whereStr += ` AND ${table}_table.user_level=${level} `;
        }
        if (category_pk) {
            whereStr += ` AND ${table}_table.category_pk=${category_pk} `;
        }
        if (status) {
            whereStr += ` AND ${table}_table.status=${status} `;
        }
        if (type) {
            whereStr += ` AND ${table}_table.type=${type} `;
        }
        if (user_pk) {
            whereStr += ` AND ${table}_table.user_pk=${user_pk} `;
        }
        if (master_pk) {
            whereStr += ` AND ${table}_table.master_pk=${master_pk} `;
        }
        if (city_pk) {
            whereStr += ` AND ${table}_table.city_pk=${city_pk} `;
        }
        if (shop_pk) {
            whereStr += ` AND ${table}_table.shop_pk=${shop_pk} `;
        }
        if (academy_category_pk) {
            whereStr += ` AND ${table}_table.academy_category_pk=${academy_category_pk} `;
        }
        if (difficulty) {
            whereStr += ` AND ${table}_table.difficulty=${difficulty} `;
        }
        if (price_is_minus) {
            whereStr += ` AND ${table}_table.transaction_status ${price_is_minus == 1 ? ' = -1 ' : ' = 0 '} `;
        }
        if (start_date && end_date) {
            whereStr += ` AND (${table}_table.trade_date BETWEEN '${start_date} 00:00:00' AND '${end_date} 23:59:59' )`;
        }
        if (comment_type) {
            if (comment_type == 'shop') {
                whereStr += ` AND ${table}_table.shop_pk > 0 `;
            } else if (comment_type == 'post') {
                whereStr += ` AND ${table}_table.post_pk > 0 `;
            }
        }
        if (keyword) {
            if (keyword_columns?.length > 0) {
                whereStr += " AND (";
                for (var i = 0; i < keyword_columns.length; i++) {
                    whereStr += ` ${i != 0 ? 'OR' : ''} ${keyword_columns[i]} LIKE '%${keyword}%' `;
                }
                whereStr += ")";
            }
        }
        if (!page_cut) {
            page_cut = 15;
        }

        sql = await sqlJoinFormat(table, sql, order, pageSql, "", decode).sql;
        pageSql = await sqlJoinFormat(table, sql, order, pageSql, "", decode).page_sql;
        order = await sqlJoinFormat(table, sql, order, pageSql, "", decode).order;
        whereStr = await sqlJoinFormat(table, sql, order, pageSql, whereStr, decode).where_str;
        pageSql = pageSql + whereStr;

        sql = sql + whereStr + ` ORDER BY ${order ? order : 'sort'} DESC `;
        if (limit && !page) {
            sql += ` LIMIT ${limit} `;
        }

        if (page) {
            sql += ` LIMIT ${(page - 1) * page_cut}, ${page_cut}`;
            let get_result = await getItemsReturnBySchema(sql, pageSql, table, req?.body);
            let page_result = get_result?.page_result;
            let result = get_result?.result;

            let want_use_count = ['user', 'comment'];
            result = await listFormatBySchema(table, result);
            let maxPage = page_result[0]['COUNT(*)'] % page_cut == 0 ? (page_result[0]['COUNT(*)'] / page_cut) : ((page_result[0]['COUNT(*)'] - page_result[0]['COUNT(*)'] % page_cut) / page_cut + 1);
            let option_obj = await getOptionObjBySchema(table, whereStr);
            if (want_use_count.includes(table)) {
                option_obj['result_count'] = {
                    title: '검색결과 수',
                    content: commarNumber(page_result[0]['COUNT(*)'])
                }
            }
            return response(req, res, 100, "success", { data: result, maxPage: maxPage, option_obj: option_obj });

        } else {
            let get_result = await getItemsReturnBySchema(sql, pageSql, table, req?.body);
            let result = get_result?.result;
            result = await listFormatBySchema(table, result);
            return response(req, res, 100, "success", result);
        }
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getItemsReturnBySchema = async (sql_, pageSql_, schema_, body_) => {
    let sql = sql_;
    let pageSql = pageSql_;
    let schema = schema_;
    let body = body_;
    let another_get_item_schema = ['user_statistics'];
    let page_result = [{ 'COUNT(*)': 0 }];
    let result = [];
    if (another_get_item_schema.includes(schema)) {

    } else {
        page_result = await dbQueryList(pageSql);
        page_result = page_result?.result;
        result = await dbQueryList(sql);
        result = result?.result;
    }
    return {
        page_result: page_result,
        result: result
    }
}
const getMyItems = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let { table, page, page_cut } = req.body;
        let data = [];
        let data_length = 0;
        if (page) {
            data_length = await dbQueryList(`SELECT COUNT(*) FROM ${table}_table WHERE user_pk=${decode?.pk}`);
            data_length = data_length?.result[0]['COUNT(*)'];
        }
        let sql = `SELECT * FROM ${table}_table `;
        sql = await myItemSqlJoinFormat(table, sql).sql;
        sql += ` WHERE ${table}_table.user_pk=${decode?.pk} ORDER BY pk DESC `
        sql += (page ? `LIMIT ${(page - 1) * page_cut}, ${(page) * page_cut}` : ``)

        data = await dbQueryList(sql);
        data = data?.result;
        let maxPage = await makeMaxPage(data_length, page_cut);
        return response(req, res, 100, "success", { maxPage: maxPage, data: data });
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getMyItem = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let { table, pk } = req.body;
        let data = {};
        let sql = `SELECT * FROM ${table}_table WHERE user_pk=${decode?.pk} AND pk=${pk}`;
        data = await dbQueryList(sql);
        data = data?.result[0];
        return response(req, res, 100, "success", data);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
function addDays(date, days) {
    const clone = new Date(date);
    clone.setDate(date.getDate() + days)
    return clone;
}

const getSetting = async (req, res) => {
    const { shop_id = -1, post_id = -1, post_table = "" } = req.query;
    try {
        let result = await dbQueryList("SELECT * FROM setting_table ORDER BY pk DESC LIMIT 1");
        result = result?.result[0];
        if (shop_id > 0) {
            let shop_data = await dbQueryList("SELECT * FROM shop_table WHERE pk=?", [shop_id]);
            shop_data = shop_data?.result[0];
            result.meta_title = shop_data?.sub_name
            result.meta_description = shop_data?.description
            result.meta_keywords = shop_data?.hash
            result.img_src = shop_data?.img_src
        }
        if (post_id > 0 && post_table) {
            let post_data = await dbQueryList(`SELECT * FROM ${post_table}_table WHERE pk=?`, [post_id]);
            post_data = post_data?.result[0];
            result.meta_title = post_data?.title
            result.meta_description = post_data?.title
            result.meta_keywords = post_data?.title
        }
        return response(req, res, 100, "success", result)

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const deleteItem = (req, res) => {
    try {
        let pk = req.body.pk ?? 0;
        let table = req.body.table ?? "";
        let sql = `DELETE FROM ${table}_table WHERE pk=? `
        db.query(sql, [pk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const addSetting = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 25)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const image = (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req.file.fieldname + '/' + req.file.filename;
        db.query("INSERT INTO setting_table (main_img) VALUES (?)", [image], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateSetting = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const { pk, file2_link, banner_2_status } = req.body;
        let image1 = "";
        let image2 = "";
        let sql = ""
        let values = [];
        sql = "UPDATE setting_table SET file2_link=?, banner_2_status=?,";
        values.push(file2_link);
        values.push(banner_2_status);
        if (req.files?.content) {
            image1 = (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req?.files?.content[0]?.fieldname + '/' + req?.files?.content[0]?.filename;
            sql += " main_img=?,";
            values.push(image1);
        }
        if (req.files?.content2) {
            image2 = (process.env.NODE_ENV == 'development' ? process.env.BACK_URL_TEST : process.env.BACK_URL) + '/image/' + req?.files?.content2[0]?.fieldname + '/' + req?.files?.content2[0]?.filename;
            sql += " banner_2_img=?,";
            values.push(image2);
        }
        sql = sql.substring(0, sql.length - 1);
        sql += " WHERE pk=? ";
        values.push(pk);
        db.query(sql, values, (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })

    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateStatus = (req, res) => {
    try {
        const { table, pk, num, column } = req.body;
        db.query(`UPDATE ${table}_table SET ${column}=? WHERE pk=? `, [num, pk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onTheTopItem = async (req, res) => {
    try {
        const { table, pk } = req.body;
        let result = await dbQueryList(`SELECT max(sort) from ${table}_table`);
        result = result?.result;
        let max_pk = result[0]['max(sort)'];
        await db.query(`UPDATE ${table}_table SET sort=? WHERE pk=? `, [max_pk + 1, pk], async (err, result2) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                let result = insertQuery(`ALTER TABLE ${table}_table AUTO_INCREMENT=?`, [max_pk + 2])
                return response(req, res, 100, "success", [])
            }
        })

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onJump = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        const { pk } = req.body;
        let shop_columns = [
            `pk`,
            `user_pk`,
            `daily_jump_count`,
            `(SELECT COUNT(*) FROM jump_table WHERE shop_pk=shop_table.pk AND date>='${returnMoment().substring(0, 10)} 00:00:00' AND shop_pk=shop_table.pk AND date<='${returnMoment().substring(0, 10)} 23:59:59') AS use_jump_count`,
        ]
        let shop = await dbQueryList(`SELECT ${shop_columns.join()} FROM shop_table WHERE pk=${pk} `);
        shop = shop?.result[0];

        if (!(decode?.user_level >= 40) && shop?.user_pk != decode?.pk) {
            return lowLevelResponse(req, res);
        }

        if (shop?.use_jump_count >= shop?.daily_jump_count) {
            return response(req, res, -100, "점프를 모두 소진하였습니다.", [])
        }

        let result = await insertQuery(`INSERT INTO jump_table (shop_pk, user_pk) VALUES (?, ?)`, [
            pk,
            decode?.pk
        ])
        return response(req, res, 100, "success", [])


    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateJumpTimeTable = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        const { pk, time_table = '[]' } = req.body;
        let shop_columns = [
            `pk`,
            `user_pk`,
            `daily_jump_count`,
            `(SELECT COUNT(*) FROM jump_table WHERE shop_pk=shop_table.pk AND date>='${returnMoment().substring(0, 10)} 00:00:00' AND shop_pk=shop_table.pk AND date<='${returnMoment().substring(0, 10)} 23:59:59') AS use_jump_count`,
        ]
        let shop = await dbQueryList(`SELECT ${shop_columns.join()} FROM shop_table WHERE pk=${pk} `);
        shop = shop?.result[0];

        if (!(decode?.user_level >= 40) && shop?.user_pk != decode?.pk) {
            return lowLevelResponse(req, res);
        }

        let result = await insertQuery(`UPDATE shop_table SET jump_time_table=? WHERE pk=? `, [
            time_table,
            pk,
        ])
        return response(req, res, 100, "success", [])


    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateShopManager = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        let { pk, manager_list = '[]' } = req.body;

        manager_list = JSON.parse(manager_list);

        let ago_manager_list = await dbQueryList(`SELECT * FROM shop_manager_table WHERE shop_pk=?`, [pk]);
        ago_manager_list = ago_manager_list?.result;
        for (var i = 0; i < manager_list.length; i++) {
            if (manager_list[i]?.pk > 0) {
                let find_manager = _.find(ago_manager_list, { pk: manager_list[i]?.pk });
                if (
                    find_manager?.img_src != manager_list[i]?.img_src ||
                    find_manager?.name != manager_list[i]?.name ||
                    find_manager?.comment != manager_list[i]?.comment ||
                    find_manager?.work_time != manager_list[i]?.work_time
                ) {
                    let result = await insertQuery(`UPDATE shop_manager_table SET img_src=?, name=?, comment=?, work_time=?, status=0 WHERE pk=?`, [
                        manager_list[i]?.img_src,
                        manager_list[i]?.name,
                        manager_list[i]?.comment,
                        manager_list[i]?.work_time,
                        manager_list[i]?.pk,
                    ])
                    console.log(1)
                }
            } else {
                let result = await insertQuery(`INSERT INTO shop_manager_table (shop_pk, img_src, name, status, comment, work_time) VALUES (?, ?, ?, ?, ?, ?)`, [
                    pk,
                    manager_list[i]?.img_src ?? "",
                    manager_list[i]?.name ?? "",
                    0,
                    manager_list[i]?.comment ?? "",
                    manager_list[i]?.work_time ?? "",
                ])
                console.log(2)

            }
        }

        return response(req, res, 100, "success", [])


    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const changeItemSequence = (req, res) => {
    try {
        const { pk, sort, table, change_pk, change_sort } = req.body;
        let date = new Date();
        date = parseInt(date.getTime() / 1000);

        let sql = `UPDATE ${table}_table SET sort=${change_sort} WHERE pk=?`;
        let settingSql = "";
        if (sort > change_sort) {
            settingSql = `UPDATE ${table}_table SET sort=sort+1 WHERE sort < ? AND sort >= ? AND pk!=? `;
        } else if (change_sort > sort) {
            settingSql = `UPDATE ${table}_table SET sort=sort-1 WHERE sort > ? AND sort <= ? AND pk!=? `;
        } else {
            return response(req, res, -100, "둘의 값이 같습니다.", [])
        }
        db.query(sql, [pk], async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                await db.query(settingSql, [sort, change_sort, pk], async (err, result) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "서버 에러 발생", [])
                    } else {
                        return response(req, res, 100, "success", [])
                    }
                })
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getAddressByText = async (req, res) => {
    try {
        let { text } = req.body;
        let client_id = '3fbdbua1qd';
        let client_secret = 'sLpgki9KM7Rw60uQGwZTuiDj9b8eRH8HxSyecQOI';
        let api_url = 'https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode'; // json
        if (!text) {
            return response(req, res, -100, "주소명을 입력 후 검색 버튼을 눌러주세요.", []);
        }
        const coord = await axios.get(`${api_url}`, {
            params: {
                query: text,
            },
            headers: {
                "X-NCP-APIGW-API-KEY-ID": `${client_id}`,
                "X-NCP-APIGW-API-KEY": `${client_secret}`,
            },
        })
        if (!coord.data.addresses) {
            return response(req, res, 100, "success", []);
        } else {
            let result = [];
            for (var i = 0; i < coord.data.addresses.length; i++) {
                result[i] = {
                    lng: coord.data.addresses[i].x,
                    lat: coord.data.addresses[i].y,
                    road_address: coord.data.addresses[i].roadAddress,
                    address: coord.data.addresses[i].jibunAddress
                }
                for (var j = 0; j < coord.data.addresses[i].addressElements.length; j++) {
                    if (coord.data.addresses[i].addressElements[j]?.types[0] == 'POSTAL_CODE') {
                        result[i].zip_code = coord.data.addresses[i].addressElements[j]?.longName;
                    }
                    if (coord.data.addresses[i].addressElements[j]?.types[0] == 'LAND_NUMBER') {
                        result[i].land_number = coord.data.addresses[i].addressElements[j]?.longName;
                    }
                }
            }
            if (result.length > 0) {
                return response(req, res, 100, "success", result);
            } else {
                return response(req, res, -100, "올바르지 않은 주소입니다. 주소를 다시 입력해 주세요.", result);
            }
        }
    } catch (e) {
        console.log(e);
        return response(req, res, -200, "서버 에러 발생", []);
    }
}
const getAddressByLocation = async (req, res) => {
    try {
        let { longitude, latitude } = req.body;
        let client_id = '3fbdbua1qd';
        let client_secret = 'sLpgki9KM7Rw60uQGwZTuiDj9b8eRH8HxSyecQOI';
        let api_url = 'https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc'; // json
        if (!longitude || !latitude) {
            return response(req, res, -100, "경도 위도를 전달해 주세요.", []);
        }
        const coord = await axios.get(`${api_url}`, {
            params: {
                coords: `${longitude},${latitude}`,
                output: 'json',
                orders: 'roadaddr,addr',
            },
            headers: {
                "X-NCP-APIGW-API-KEY-ID": `${client_id}`,
                "X-NCP-APIGW-API-KEY": `${client_secret}`,
            },
        })
        const { name, region, land } = coord?.data?.results[0];
        const { area1, area2, area3, area4 } = region;
        const { addition0, addition1, addition2, addition3, addition4 } = land;
        let dong = area3.name;
        let dong_str = ``;
        for (var i = 0; i < dong.length; i++) {
            if (i != 0 && dong[i] == '동') {
                dong_str += `동`;
                break;
            }
            dong_str += dong[i];
        }
        const address = `${area2.name} ${dong_str} ${area4.name} `;
        return response(req, res, 100, "success", address);

    } catch (e) {
        console.log(e);
        return response(req, res, -200, "서버 에러 발생", []);
    }
}

function excelDateToJSDate(serial) {
    var utc_days = Math.floor(serial - 25569);
    var utc_value = utc_days * 86400;
    var date_info = new Date(utc_value * 1000);
    var fractional_day = serial - Math.floor(serial) + 0.0000001;
    var total_seconds = Math.floor(86400 * fractional_day);
    var seconds = total_seconds % 60;
    total_seconds -= seconds;
    var hours = Math.floor(total_seconds / (60 * 60));
    var minutes = Math.floor(total_seconds / 60) % 60;
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}



module.exports = {
    onLoginById, getUserToken, onLogout, checkExistId, checkPassword, checkExistIdByManager, checkExistNickname, sendSms, kakaoCallBack, editMyInfo, uploadProfile, onLoginBySns, getAddressByText, getMyInfo, getShops, //auth
    getUsers, getItems, getHomeContent, getSetting, getVideo, onSearchAllItem, findIdByPhone, findAuthByIdAndPhone, getComments, getCommentsManager, getAllPosts, getUserStatistics, itemCount, addImageItems,//select
    onSignUp, addItem, addItemByUser, addNoteImage, addSetting, addComment, addPopup, updateJumpTimeTable, updateShopManager, //insert 
    updateUser, updateItem, updateSetting, updateStatus, onTheTopItem, changeItemSequence, changePassword, updateComment, updatePopup,//update
    deleteItem, onResign, getMyItems, getMyItem, getHeaderContent, getMasterContent, getReviewByMasterPk, getShop, getAddressByLocation, onJump
}
