const React = require('react');
const PropTypes = require('prop-types');
function Markdown({ children }) {
  return React.createElement('div', { 'data-testid': 'markdown' }, children);
}
Markdown.propTypes = { children: PropTypes.node };
module.exports = Markdown;
module.exports.default = Markdown;
