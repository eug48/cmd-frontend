import { c as createCommonjsModule, u as unwrapExports, a as commonjsGlobal } from './common/_commonjsHelpers-6a48b99e.js';

var date = createCommonjsModule(function (module, exports) {
/**
 * Created by hustcc on 18/5/20.
 * Contract: i@hust.cc
 */
Object.defineProperty(exports, "__esModule", { value: true });
var SEC_ARRAY = [60, 60, 24, 7, 365 / 7 / 12, 12];
/**
 * format Date / string / timestamp to timestamp
 * @param input
 * @returns {*}
 */
function toDate(input) {
    if (input instanceof Date)
        return input;
    // @ts-ignore
    if (!isNaN(input) || /^\d+$/.test(input))
        return new Date(parseInt(input));
    input = (input || '')
        // @ts-ignore
        .trim()
        .replace(/\.\d+/, '') // remove milliseconds
        .replace(/-/, '/')
        .replace(/-/, '/')
        .replace(/(\d)T(\d)/, '$1 $2')
        .replace(/Z/, ' UTC') // 2017-2-5T3:57:52Z -> 2017-2-5 3:57:52UTC
        .replace(/([+-]\d\d):?(\d\d)/, ' $1$2'); // -04:00 -> -0400
    return new Date(input);
}
exports.toDate = toDate;
/**
 * format the diff second to *** time ago, with setting locale
 * @param diff
 * @param localeFunc
 * @returns
 */
function formatDiff(diff, localeFunc) {
    // if locale is not exist, use defaultLocale.
    // if defaultLocale is not exist, use build-in `en`.
    // be sure of no error when locale is not exist.
    var agoIn = diff < 0 ? 1 : 0; // time in or time ago
    diff = Math.abs(diff);
    var totalSec = diff;
    var idx = 0;
    for (; diff >= SEC_ARRAY[idx] && idx < SEC_ARRAY.length; idx++) {
        diff /= SEC_ARRAY[idx];
    }
    // Math.floor
    diff = ~~diff;
    idx *= 2;
    if (diff > (idx === 0 ? 9 : 1))
        idx += 1;
    // @ts-ignore
    return localeFunc(diff, idx, totalSec)[agoIn].replace('%s', diff);
}
exports.formatDiff = formatDiff;
/**
 * calculate the diff second between date to be formatted an now date.
 * @param date
 * @param relativeDate
 * @returns
 */
function diffSec(date, relativeDate) {
    relativeDate = relativeDate ? toDate(relativeDate) : new Date();
    return (+relativeDate - +toDate(date)) / 1000;
}
exports.diffSec = diffSec;
/**
 * nextInterval: calculate the next interval time.
 * - diff: the diff sec between now and date to be formatted.
 *
 * What's the meaning?
 * diff = 61 then return 59
 * diff = 3601 (an hour + 1 second), then return 3599
 * make the interval with high performance.
 **/
function nextInterval(diff) {
    var rst = 1, i = 0, d = Math.abs(diff);
    for (; diff >= SEC_ARRAY[i] && i < SEC_ARRAY.length; i++) {
        diff /= SEC_ARRAY[i];
        rst *= SEC_ARRAY[i];
    }
    d = d % rst;
    d = d ? rst - d : rst;
    return Math.ceil(d);
}
exports.nextInterval = nextInterval;

});

unwrapExports(date);
var date_1 = date.toDate;
var date_2 = date.formatDiff;
var date_3 = date.diffSec;
var date_4 = date.nextInterval;

var en_US = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
var EN_US = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];
function default_1(diff, idx) {
    if (idx === 0)
        return ['just now', 'right now'];
    var unit = EN_US[~~(idx / 2)];
    if (diff > 1)
        unit += 's';
    return [diff + " " + unit + " ago", "in " + diff + " " + unit];
}
exports.default = default_1;

});

unwrapExports(en_US);

var zh_CN = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
var ZH_CN = ['秒', '分钟', '小时', '天', '周', '个月', '年'];
function default_1(diff, idx) {
    if (idx === 0)
        return ['刚刚', '片刻后'];
    var unit = ZH_CN[~~(idx / 2)];
    return [diff + " " + unit + "\u524D", diff + " " + unit + "\u540E"];
}
exports.default = default_1;

});

unwrapExports(zh_CN);

var locales = createCommonjsModule(function (module, exports) {
/**
 * Created by hustcc on 18/5/20.
 * Contract: i@hust.cc
 */
var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var en_US_1 = __importDefault(en_US);
var zh_CN_1 = __importDefault(zh_CN);
/**
 * All locales supported. en_US, zh_CN is build-in
 * @type {{en: function(*, *), zh_CN: function(*, *)}}
 */
var Locales = {
    en_US: en_US_1.default,
    zh_CN: zh_CN_1.default,
};
/**
 * register a locale
 * @param locale
 * @param func
 */
exports.register = function (locale, func) {
    Locales[locale] = func;
};
/**
 * get a locale, default is en_US
 * @param locale
 * @returns {*}
 */
exports.getLocale = function (locale) {
    return Locales[locale] || en_US_1.default;
};

});

unwrapExports(locales);
var locales_1 = locales.register;
var locales_2 = locales.getLocale;

var format = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });


/**
 * format a TDate into string
 * @param date
 * @param locale
 * @param opts
 */
exports.format = function (date$1, locale, opts) {
    // diff seconds
    var sec = date.diffSec(date$1, opts && opts.relativeDate);
    // format it with locale
    return date.formatDiff(sec, locales.getLocale(locale));
};

});

unwrapExports(format);
var format_1 = format.format;

var dom = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
var ATTR_TIMEAGO_TID = 'timeago-id';
/**
 * get the datetime attribute, `datetime` are supported.
 * @param node
 * @returns {*}
 */
function getDateAttribute(node) {
    return node.getAttribute('datetime');
}
exports.getDateAttribute = getDateAttribute;
/**
 * set the node attribute, native DOM
 * @param node
 * @param timerId
 * @returns {*}
 */
function setTimerId(node, timerId) {
    // @ts-ignore
    node.setAttribute(ATTR_TIMEAGO_TID, timerId);
}
exports.setTimerId = setTimerId;
/**
 * get the timer id
 * @param node
 */
function getTimerId(node) {
    return parseInt(node.getAttribute(ATTR_TIMEAGO_TID));
}
exports.getTimerId = getTimerId;

});

unwrapExports(dom);
var dom_1 = dom.getDateAttribute;
var dom_2 = dom.setTimerId;
var dom_3 = dom.getTimerId;

var realtime = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });



// all realtime timer
var TIMER_POOL = {};
/**
 * clear a timer from pool
 * @param tid
 */
var clear = function (tid) {
    clearTimeout(tid);
    delete TIMER_POOL[tid];
};
// run with timer(setTimeout)
function run(node, date$1, localeFunc, opts) {
    // clear the node's exist timer
    clear(dom.getTimerId(node));
    var relativeDate = opts.relativeDate, minInterval = opts.minInterval;
    // get diff seconds
    var diff = date.diffSec(date$1, relativeDate);
    // render
    node.innerText = date.formatDiff(diff, localeFunc);
    var tid = setTimeout(function () {
        run(node, date$1, localeFunc, opts);
    }, Math.min(Math.max(date.nextInterval(diff), minInterval || 1) * 1000, 0x7fffffff));
    // there is no need to save node in object. Just save the key
    TIMER_POOL[tid] = 0;
    dom.setTimerId(node, tid);
}
// 取消一个 node 的实时渲染
function cancel(node) {
    // cancel one
    if (node)
        clear(dom.getTimerId(node));
    // cancel all
    // @ts-ignore
    else
        Object.keys(TIMER_POOL).forEach(clear);
}
exports.cancel = cancel;
/**
 * render a dom realtime
 * @param nodes
 * @param locale
 * @param opts
 */
function render(nodes, locale, opts) {
    // by .length
    // @ts-ignore
    var nodeList = nodes.length ? nodes : [nodes];
    nodeList.forEach(function (node) {
        run(node, dom.getDateAttribute(node), locales.getLocale(locale), opts || {});
    });
    return nodeList;
}
exports.render = render;

});

unwrapExports(realtime);
var realtime_1 = realtime.cancel;
var realtime_2 = realtime.render;

var lib = createCommonjsModule(function (module, exports) {
/**
 * Created by hustcc on 18/5/20.
 * Contract: i@hust.cc
 */
Object.defineProperty(exports, "__esModule", { value: true });

exports.format = format.format;

exports.render = realtime.render;
exports.cancel = realtime.cancel;

exports.register = locales.register;

});

var index = unwrapExports(lib);
var lib_1 = lib.format;
var lib_2 = lib.render;
var lib_3 = lib.cancel;
var lib_4 = lib.register;

export default index;
export { lib_3 as cancel, lib_1 as format, lib_4 as register, lib_2 as render };
