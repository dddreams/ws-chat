/* 为了让 node 支持 ES7 ，使用 babel 进行转码，babel 转码时，
 * 需要指定presets和plugins。presets是规则，我们stage-3规则，stage-3规则是ES7的stage 0~3的第3阶段规则。
 * plugins可以指定插件来定制转码过程，一个preset就包含了一组指定的plugin。
 * 为了让async语法能正常执行，我们只需要指定ES7的stage-3规则。
 */
var register = require('babel-core/register');

register({
    presets: ['stage-3']
});

require('./app.js');