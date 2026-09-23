/* Early auth gate: hide protected app chrome before Firebase resolves the session. */
(function () {
  try {
    document.documentElement.dataset.authRequired = 'true';
    document.documentElement.classList.add('auth-pending');

    const style = document.createElement('style');
    style.id = 'trio-auth-preload-style';
    style.textContent = [
      'html.auth-pending body{visibility:hidden!important}',
      'html.auth-pending body:before{content:"";position:fixed;inset:0;z-index:2147483646;background:#070511;visibility:visible!important}',
      'html.auth-pending body:after{content:"";position:fixed;left:50%;top:50%;width:42px;height:42px;margin:-21px;z-index:2147483647;border:2px solid rgba(139,92,246,.22);border-top-color:#a78bfa;border-radius:50%;animation:trioAuthSpin 1s linear infinite;visibility:visible!important}',
      '@keyframes trioAuthSpin{to{transform:rotate(360deg)}}',
      '@media(prefers-reduced-motion:reduce){html.auth-pending body:after{animation:none;border-color:#a78bfa}}'
    ].join('');
    document.head.appendChild(style);
  } catch (_) {}
})();