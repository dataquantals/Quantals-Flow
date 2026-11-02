/* ==========================================================================
   Account Profile Management (assets/js/profile.js)
   Apple HIG & Emil Kowalski Polish:
   - Intentional whitespace, calm typography, fluid tactile feedback
   - Seamless PATCH /api/auth/me and POST /api/auth/change-password
   - Instant avatar and presence re-synchronization
   ========================================================================== */
(function () {
  'use strict';

  var currentUser = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(el, text, isSuccess) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'profile-status-msg' + (text ? (isSuccess ? ' is-success' : ' is-error') : '');
  }

  function scorePassword(pass) {
    var p = String(pass || '');
    if (!p) return 0;
    var score = 0;
    if (p.length >= 6) score += 25;
    if (p.length >= 10) score += 25;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 25;
    if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) score += 25;
    return score;
  }

  function updateStrength(pass) {
    var bar = $('prof-strength-bar');
    var label = $('prof-strength-label');
    if (!bar || !label) return;

    if (!pass) {
      bar.style.width = '0%';
      bar.className = 'strength__bar';
      label.textContent = 'Minimum 6 characters.';
      label.style.color = '#64748b';
      return;
    }

    var score = scorePassword(pass);
    bar.style.width = Math.max(15, score) + '%';

    if (pass.length < 6) {
      bar.className = 'strength__bar strength__bar--weak';
      label.textContent = 'Too short (min 6 characters)';
      label.style.color = '#ef4444';
    } else if (score < 50) {
      bar.className = 'strength__bar strength__bar--weak';
      label.textContent = 'Weak password';
      label.style.color = '#ea580c';
    } else if (score < 80) {
      bar.className = 'strength__bar strength__bar--fair';
      label.textContent = 'Good password';
      label.style.color = '#3b82f6';
    } else {
      bar.className = 'strength__bar strength__bar--strong';
      label.textContent = 'Strong password';
      label.style.color = '#10b981';
    }
  }

  function formatDate(ts) {
    if (!ts) return 'Recent';
    try {
      var d = new Date(ts);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recent';
    }
  }

  function renderUserData(user) {
    currentUser = user;
    var name = user.name || 'QuantalFlow Collaborator';
    var email = user.email || '';
    var initial = name.trim().charAt(0).toUpperCase() || 'U';

    var av = $('profile-avatar-preview');
    var removeBtn = $('btn-remove-avatar');
    var headAv = $('prof-header-initial');
    var avUrl = user.avatar_url || user.avatarUrl || user.avatar || user.imageUrl;
    if (av) {
      if (avUrl) {
        av.innerHTML = '<img src="' + avUrl + '" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
      } else {
        av.textContent = initial;
        if (removeBtn) removeBtn.style.display = 'none';
      }
    }

    if (headAv) {
      if (avUrl) {
        headAv.innerHTML = '<img src="' + avUrl + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" />';
      } else {
        headAv.textContent = initial;
      }
    }

    var dispName = $('profile-display-name');
    if (dispName) dispName.textContent = name;

    var dispEmail = $('profile-display-email');
    if (dispEmail) dispEmail.textContent = email;

    var nameInput = $('prof-name');
    if (nameInput) nameInput.value = user.name || '';

    var emailInput = $('prof-email');
    if (emailInput) emailInput.value = email;

    var titleInput = $('prof-title');
    if (titleInput) titleInput.value = user.title || '';

    var companyInput = $('prof-company');
    if (companyInput) companyInput.value = user.company || '';

    var bioInput = $('prof-bio');
    if (bioInput) {
      bioInput.value = user.bio || '';
      var bioCount = $('prof-bio-count');
      if (bioCount) bioCount.textContent = (user.bio || '').length;
    }

    var roleBadge = $('profile-role-badge');
    if (roleBadge) {
      var roleText = (user.role || 'member').toUpperCase();
      roleBadge.textContent = roleText;
      roleBadge.className = 'profile-role-badge' + (user.role === 'owner' ? ' is-owner' : '');
    }

    var infraId = $('profile-infra-id');
    if (infraId) infraId.textContent = 'usr_' + (user.id || 1);

    var infraRole = $('profile-infra-role');
    if (infraRole) infraRole.textContent = user.role === 'owner' ? 'Workspace Owner & Admin' : 'Active Team Member';

    var infraDate = $('profile-infra-date');
    if (infraDate) infraDate.textContent = formatDate(user.created_at);
  }

  // Load current session
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) {
        window.location.replace('/login/?next=' + encodeURIComponent('/profile/'));
        return null;
      }
      return r.json();
    })
    .then(function (data) {
      if (data && data.user) {
        renderUserData(data.user);
      }
    })
    .catch(function () {
      window.location.replace('/login/?next=' + encodeURIComponent('/profile/'));
    });

  // Bio character counter
  var bioInput = $('prof-bio');
  if (bioInput) {
    bioInput.addEventListener('input', function () {
      var count = $('prof-bio-count');
      if (count) count.textContent = bioInput.value.length;
    });
  }

  // Password visibility toggles
  document.querySelectorAll('[data-toggle-pass]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var inputId = btn.getAttribute('data-toggle-pass');
      var input = $(inputId);
      if (!input) return;
      var isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? 'Hide' : 'Show';
    });
  });

  // New password strength listening
  var newPassInput = $('prof-new-pass');
  if (newPassInput) {
    newPassInput.addEventListener('input', function () {
      updateStrength(newPassInput.value);
    });
  }

  // Handle Profile Info Update (PATCH /api/auth/me)
  var infoForm = $('profile-info-form');
  if (infoForm) {
    infoForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var msgEl = $('prof-info-msg');
      var submitBtn = $('prof-info-submit');
      setStatus(msgEl, '');

      var nameVal = ($('prof-name')?.value || '').trim();
      var titleVal = ($('prof-title')?.value || '').trim();
      var companyVal = ($('prof-company')?.value || '').trim();
      var bioVal = ($('prof-bio')?.value || '').trim();

      if (!nameVal) {
        setStatus(msgEl, 'Full Name is required.', false);
        $('prof-name')?.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving changes…';
      }

      try {
        var res = await fetch('/api/auth/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            name: nameVal,
            title: titleVal,
            company: companyVal,
            bio: bioVal
          })
        });

        var data = await res.json();
        if (res.ok && data.user) {
          renderUserData(data.user);
          setStatus(msgEl, 'Profile updated successfully.', true);
          setTimeout(function () {
            setStatus(msgEl, '');
          }, 4000);
        } else {
          setStatus(msgEl, data.error || 'Failed to update profile.', false);
        }
      } catch (err) {
        setStatus(msgEl, 'Network error. Please try again.', false);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Profile Changes';
        }
      }
    });
  }

  // Handle Password Change (POST /api/auth/change-password)
  var passForm = $('profile-pass-form');
  if (passForm) {
    passForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var msgEl = $('prof-pass-msg');
      var submitBtn = $('prof-pass-submit');
      setStatus(msgEl, '');

      var currentPass = $('prof-current-pass')?.value || '';
      var newPass = $('prof-new-pass')?.value || '';
      var confirmPass = $('prof-confirm-pass')?.value || '';

      if (!currentPass) {
        setStatus(msgEl, 'Current password is required.', false);
        $('prof-current-pass')?.focus();
        return;
      }
      if (!newPass) {
        setStatus(msgEl, 'New password is required.', false);
        $('prof-new-pass')?.focus();
        return;
      }
      if (newPass.length < 6) {
        setStatus(msgEl, 'New password must be at least 6 characters.', false);
        $('prof-new-pass')?.focus();
        return;
      }
      if (newPass !== confirmPass) {
        setStatus(msgEl, 'New passwords do not match.', false);
        $('prof-confirm-pass')?.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating password…';
      }

      try {
        var res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            currentPassword: currentPass,
            newPassword: newPass
          })
        });

        var data = await res.json();
        if (res.ok) {
          setStatus(msgEl, 'Password updated successfully.', true);
          passForm.reset();
          updateStrength('');
          setTimeout(function () {
            setStatus(msgEl, '');
          }, 4000);
        } else {
          setStatus(msgEl, data.error || 'Failed to update password.', false);
        }
      } catch (err) {
        setStatus(msgEl, 'Network error. Please try again.', false);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Update Password';
        }
      }
    });
  }

  // Handle Avatar Upload & Removal
  var avatarInput = $('profile-avatar-input');
  var triggerBtn = $('btn-trigger-upload');
  var removeBtn = $('btn-remove-avatar');
  var avatarStatus = $('profile-avatar-status');

  function setAvatarStatus(msg, isSuccess) {
    if (!avatarStatus) return;
    if (!msg) {
      avatarStatus.style.display = 'none';
      avatarStatus.textContent = '';
      return;
    }
    avatarStatus.style.display = 'block';
    avatarStatus.style.color = isSuccess ? '#059669' : '#dc2626';
    avatarStatus.textContent = msg;
  }

  if (triggerBtn && avatarInput) {
    triggerBtn.addEventListener('click', function () {
      avatarInput.click();
    });
  }

  if (avatarInput) {
    avatarInput.addEventListener('change', async function () {
      var file = avatarInput.files && avatarInput.files[0];
      if (!file) return;

      var MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        var sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        setAvatarStatus('Selected image is ' + sizeMb + 'MB. Please upload an image 5MB and below.', false);
        avatarInput.value = '';
        return;
      }

      var allowedPrefixes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
      var isAllowed = file.type && allowedPrefixes.some(function (p) { return file.type.indexOf(p) !== -1; });
      if (!isAllowed && !file.type.startsWith('image/')) {
        setAvatarStatus('Please select a valid image file (PNG, JPG, WebP, GIF, or SVG).', false);
        avatarInput.value = '';
        return;
      }

      setAvatarStatus('Uploading photo…', true);
      if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.textContent = 'Uploading…';
      }

      try {
        var res = await fetch('/api/profile/avatar', {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'image/png',
            'X-File-Name': encodeURIComponent(file.name)
          },
          credentials: 'same-origin',
          body: file
        });

        var data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        setAvatarStatus('Photo uploaded successfully and saved', true);
        if (data.user) {
          renderUserData(data.user);
        } else if (data.avatarUrl) {
          var av = $('profile-avatar-preview');
          if (av) {
            av.innerHTML = '<img src="' + data.avatarUrl + '" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />';
          }
          var headAv = $('prof-header-initial');
          if (headAv) {
            headAv.innerHTML = '<img src="' + data.avatarUrl + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" />';
          }
          if (removeBtn) removeBtn.style.display = 'inline-flex';
        }
      } catch (err) {
        setAvatarStatus(err.message || 'Failed to upload photo.', false);
      } finally {
        if (triggerBtn) {
          triggerBtn.disabled = false;
          triggerBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg><span>Upload photo</span>';
        }
        avatarInput.value = '';
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', async function () {
      if (!confirm('Remove your profile photo and revert to initial?')) return;
      removeBtn.disabled = true;
      removeBtn.textContent = 'Removing…';
      try {
        var res = await fetch('/api/profile/avatar', {
          method: 'DELETE',
          credentials: 'same-origin'
        });
        var data = await res.json();
        if (res.ok && data.ok) {
          setAvatarStatus('Profile photo removed.', true);
          if (data.user) renderUserData(data.user);
        } else {
          setAvatarStatus(data.error || 'Failed to remove photo.', false);
        }
      } catch (err) {
        setAvatarStatus(err.message || 'Failed to remove photo.', false);
      } finally {
        removeBtn.disabled = false;
        removeBtn.textContent = 'Remove';
      }
    });
  }

  // Handle Logout
  var logoutBtn = $('profile-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      logoutBtn.disabled = true;
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } catch {}
      window.location.replace('/login/');
    });
  }
})();
