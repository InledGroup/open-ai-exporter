import { render } from 'preact';
import { PopupApp } from './PopupApp';
import './style.css';

const container = document.getElementById('app');
if (container) {
  render(<PopupApp />, container);
}
