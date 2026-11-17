/**
 * Sistema de Reserva de Notebook Compartilhado — Interações UI/UX
 * - Alternância de Tema (Claro / Escuro) com persistência em localStorage
 * - Menu Responsivo Mobile
 * - Toasts com fechamento automático e pausa ao passar o mouse
 * - Seletor de Data e Hora com Botão "Confirmar" (✓) e Ícone de Confirmação
 * - Feedback visual (spinner) ao submeter formulários
 * - Alternância de visibilidade de senha no Login
 */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initMobileMenu();
    initToasts();
    initDateTimePickers();
    initFormLoadingState();
    initPasswordToggle();
  });

  /* 1. Alternância de Modo Claro / Escuro */
  function initThemeToggle() {
    var toggleButtons = document.querySelectorAll("[data-theme-toggle]");
    if (!toggleButtons.length) return;

    function updateIcons() {
      var isDark = document.documentElement.classList.contains("dark");
      document.querySelectorAll(".theme-icon-sun").forEach(function (el) {
        el.classList.toggle("hidden", !isDark);
      });
      document.querySelectorAll(".theme-icon-moon").forEach(function (el) {
        el.classList.toggle("hidden", isDark);
      });
    }

    updateIcons();

    toggleButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var html = document.documentElement;
        var isDark = html.classList.toggle("dark");
        try {
          localStorage.setItem("theme", isDark ? "dark" : "light");
        } catch (e) {}
        updateIcons();
      });
    });
  }

  /* 2. Menu Mobile (Hambúrguer) */
  function initMobileMenu() {
    var btn = document.getElementById("mobile-menu-btn");
    var menu = document.getElementById("mobile-menu");
    var iconOpen = document.getElementById("menu-icon-open");
    var iconClose = document.getElementById("menu-icon-close");

    if (!btn || !menu) return;

    btn.addEventListener("click", function () {
      var isOpen = !menu.classList.contains("hidden");
      menu.classList.toggle("hidden", isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));
      if (iconOpen && iconClose) {
        iconOpen.classList.toggle("hidden", !isOpen);
        iconClose.classList.toggle("hidden", isOpen);
      }
    });
  }

  /* 3. Toasts de Notificação */
  function initToasts() {
    var toasts = document.querySelectorAll(".toast-item");
    toasts.forEach(function (toast) {
      var timeoutId = null;
      var remaining = 5000;
      var startTime = Date.now();

      function dismissToast() {
        if (toast.classList.contains("toast-leaving")) return;
        toast.classList.add("toast-leaving");
        setTimeout(function () {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 260);
      }

      function startTimer() {
        startTime = Date.now();
        timeoutId = setTimeout(dismissToast, remaining);
      }

      toast.addEventListener("mouseenter", function () {
        if (timeoutId) {
          clearTimeout(timeoutId);
          remaining -= Date.now() - startTime;
          if (remaining < 800) remaining = 800;
        }
      });

      toast.addEventListener("mouseleave", function () {
        startTimer();
      });

      var closeBtn = toast.querySelector("[data-toast-close]");
      if (closeBtn) {
        closeBtn.addEventListener("click", function () {
          if (timeoutId) clearTimeout(timeoutId);
          dismissToast();
        });
      }

      startTimer();
    });
  }

  /* 4. Seletor de Data e Hora com Botão e Ícone de Confirmação */
  function initDateTimePickers() {
    var wrappers = document.querySelectorAll("[data-dtp-wrapper]");
    if (!wrappers.length) return;

    var meses = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    var diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
    var activePopover = null;
    var activeWrapper = null;
    var activeReposition = null;

    function pad(n) {
      return n < 10 ? "0" + n : String(n);
    }

    function formatDisplay(y, m, d, hh, mm) {
      return pad(d) + "/" + pad(m + 1) + "/" + y + " " + pad(hh) + ":" + pad(mm);
    }

    function formatISO(y, m, d, hh, mm) {
      return y + "-" + pad(m + 1) + "-" + pad(d) + "T" + pad(hh) + ":" + pad(mm);
    }

    function parseISO(isoStr) {
      if (!isoStr) return null;
      var parts = isoStr.split("T");
      if (parts.length !== 2) return null;
      var dParts = parts[0].split("-");
      var tParts = parts[1].split(":");
      if (dParts.length < 3 || tParts.length < 2) return null;
      return {
        year: parseInt(dParts[0], 10),
        month: parseInt(dParts[1], 10) - 1,
        day: parseInt(dParts[2], 10),
        hour: parseInt(tParts[0], 10),
        minute: parseInt(tParts[1], 10)
      };
    }

    function closeActivePopover() {
      if (activeReposition) {
        window.removeEventListener("scroll", activeReposition, true);
        window.removeEventListener("resize", activeReposition);
        activeReposition = null;
      }
      if (activePopover && activePopover.parentNode) {
        activePopover.parentNode.removeChild(activePopover);
      }
      activePopover = null;
      activeWrapper = null;
    }

    document.addEventListener("mousedown", function (e) {
      if (!activePopover) return;
      if (activePopover.contains(e.target)) return;
      var isTrigger = e.target.closest("[data-dtp-wrapper]");
      if (!isTrigger) closeActivePopover();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && activePopover) {
        closeActivePopover();
      }
    });

    wrappers.forEach(function (wrapper) {
      var isoInput = wrapper.querySelector("[data-dtp-iso]");
      var displayInput = wrapper.querySelector("[data-dtp-display]");
      var triggerBtn = wrapper.querySelector("[data-dtp-trigger]");
      var iconCal = wrapper.querySelector("[data-dtp-icon-cal]");
      var iconCheck = wrapper.querySelector("[data-dtp-icon-check]");

      function setConfirmedState(isConfirmed) {
        if (iconCal && iconCheck) {
          iconCal.classList.toggle("hidden", isConfirmed);
          iconCheck.classList.toggle("hidden", !isConfirmed);
        }
        displayInput.classList.toggle("border-emerald-500", isConfirmed);
        displayInput.classList.toggle("dark:border-emerald-500", isConfirmed);
      }

      // Inicializa caso já tenha valor prévio
      var initialParsed = parseISO(isoInput.value);
      if (initialParsed) {
        displayInput.value = formatDisplay(
          initialParsed.year,
          initialParsed.month,
          initialParsed.day,
          initialParsed.hour,
          initialParsed.minute
        );
        setConfirmedState(true);
      }

      function openPicker() {
        closeActivePopover();

        var now = new Date();
        var minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
        var current = parseISO(isoInput.value);

        // Se for o campo de Término, respeita a data de Início do mesmo formulário como limite mínimo
        if (isoInput.name === "data_fim") {
          var parentForm = wrapper.closest("form") || document;
          var inicioIso = parentForm.querySelector("input[name='data_inicio']");
          var inicioParsed = inicioIso ? parseISO(inicioIso.value) : null;
          if (inicioParsed) {
            var inicioDate = new Date(
              inicioParsed.year,
              inicioParsed.month,
              inicioParsed.day,
              inicioParsed.hour,
              inicioParsed.minute + 1
            );
            if (inicioDate > minDate) {
              minDate = inicioDate;
            }
            if (!current) {
              var suggestedDate = new Date(
                inicioParsed.year,
                inicioParsed.month,
                inicioParsed.day,
                inicioParsed.hour,
                inicioParsed.minute + 30
              );
              current = {
                year: suggestedDate.getFullYear(),
                month: suggestedDate.getMonth(),
                day: suggestedDate.getDate(),
                hour: suggestedDate.getHours(),
                minute: suggestedDate.getMinutes()
              };
            }
          }
        }

        var state = current || {
          year: minDate.getFullYear(),
          month: minDate.getMonth(),
          day: minDate.getDate(),
          hour: minDate.getHours(),
          minute: Math.ceil(minDate.getMinutes() / 5) * 5 % 60
        };

        // Garante que o estado inicial nunca esteja no passado
        var stateDateObj = new Date(state.year, state.month, state.day, state.hour, state.minute);
        if (stateDateObj < minDate) {
          state = {
            year: minDate.getFullYear(),
            month: minDate.getMonth(),
            day: minDate.getDate(),
            hour: minDate.getHours(),
            minute: minDate.getMinutes()
          };
        }

        var viewYear = state.year;
        var viewMonth = state.month;

        var popover = document.createElement("div");
        popover.className =
          "rounded-2xl bg-white dark:bg-slate-800 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700 p-4 select-none";
        popover.style.position = "fixed";
        popover.style.zIndex = "9999";
        popover.style.width = "340px";
        popover.style.maxWidth = "calc(100vw - 24px)";
        activePopover = popover;
        activeWrapper = wrapper;

        function positionPopover() {
          if (!activePopover) return;
          var rect = displayInput.getBoundingClientRect();
          var popWidth = Math.min(340, window.innerWidth - 24);
          var popHeight = popover.offsetHeight || 315;
          var margin = 12;

          var left = rect.left;
          if (left + popWidth > window.innerWidth - margin) {
            left = window.innerWidth - popWidth - margin;
          }
          if (left < margin) {
            left = margin;
          }

          var top = rect.bottom + 6;
          if (top + popHeight > window.innerHeight - margin) {
            if (rect.top - popHeight - 6 >= margin) {
              top = rect.top - popHeight - 6;
            } else {
              top = Math.max(margin, window.innerHeight - popHeight - margin);
            }
          }

          popover.style.left = Math.round(left) + "px";
          popover.style.top = Math.round(top) + "px";
        }

        function applyAndClose() {
          isoInput.value = formatISO(state.year, state.month, state.day, state.hour, state.minute);
          displayInput.value = formatDisplay(state.year, state.month, state.day, state.hour, state.minute);
          displayInput.setCustomValidity("");
          setConfirmedState(true);
          closeActivePopover();
        }

        function clearAndClose() {
          isoInput.value = "";
          displayInput.value = "";
          setConfirmedState(false);
          closeActivePopover();
        }

        function render() {
          popover.innerHTML = "";

          // Layout superior: Calendário (esquerda) + Hora/Minuto (direita)
          var topGrid = document.createElement("div");
          topGrid.className = "grid grid-cols-12 gap-3";

          // Coluna do Calendário (8 colunas)
          var calCol = document.createElement("div");
          calCol.className = "col-span-8 pr-2 border-r border-slate-100 dark:border-slate-700";

          // Cabeçalho do Mês
          var header = document.createElement("div");
          header.className = "flex items-center justify-between mb-2.5";

          var monthTitle = document.createElement("span");
          monthTitle.className = "text-xs font-bold capitalize text-slate-800 dark:text-slate-100";
          monthTitle.textContent = meses[viewMonth] + " de " + viewYear;

          var navBtns = document.createElement("div");
          navBtns.className = "flex items-center gap-1";

          var prevBtn = document.createElement("button");
          prevBtn.type = "button";
          var isMinMonth =
            viewYear < minDate.getFullYear() ||
            (viewYear === minDate.getFullYear() && viewMonth <= minDate.getMonth());
          prevBtn.disabled = isMinMonth;
          prevBtn.className =
            "p-1 rounded-lg transition-colors " +
            (isMinMonth
              ? "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300");
          prevBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>';
          if (!isMinMonth) {
            prevBtn.addEventListener("click", function () {
              viewMonth--;
              if (viewMonth < 0) {
                viewMonth = 11;
                viewYear--;
              }
              render();
            });
          }

          var nextBtn = document.createElement("button");
          nextBtn.type = "button";
          nextBtn.className = "p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300";
          nextBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>';
          nextBtn.addEventListener("click", function () {
            viewMonth++;
            if (viewMonth > 11) {
              viewMonth = 0;
              viewYear++;
            }
            render();
          });

          navBtns.appendChild(prevBtn);
          navBtns.appendChild(nextBtn);
          header.appendChild(monthTitle);
          header.appendChild(navBtns);
          calCol.appendChild(header);

          // Cabeçalho Dias da Semana
          var weekRow = document.createElement("div");
          weekRow.className = "grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1";
          diasSemana.forEach(function (d) {
            var el = document.createElement("span");
            el.textContent = d;
            weekRow.appendChild(el);
          });
          calCol.appendChild(weekRow);

          // Dias do Mês
          var daysGrid = document.createElement("div");
          daysGrid.className = "grid grid-cols-7 gap-0.5 text-center";

          var firstDay = new Date(viewYear, viewMonth, 1).getDay();
          var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
          var minDayStart = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0);

          for (var i = 0; i < firstDay; i++) {
            var empty = document.createElement("span");
            daysGrid.appendChild(empty);
          }

          for (var d = 1; d <= daysInMonth; d++) {
            (function (dayNum) {
              var dayBtn = document.createElement("button");
              dayBtn.type = "button";
              var thisDayEnd = new Date(viewYear, viewMonth, dayNum, 23, 59, 59);
              var isPastDay = thisDayEnd < minDayStart;
              var isSelected =
                state.year === viewYear &&
                state.month === viewMonth &&
                state.day === dayNum;
              var isToday =
                now.getFullYear() === viewYear &&
                now.getMonth() === viewMonth &&
                now.getDate() === dayNum;

              if (isPastDay) {
                dayBtn.disabled = true;
                dayBtn.title = "Data passada indisponível";
                dayBtn.className =
                  "h-7 w-7 mx-auto rounded-lg text-xs font-normal flex items-center justify-center text-slate-300 dark:text-slate-600 line-through cursor-not-allowed opacity-45";
              } else {
                dayBtn.className =
                  "h-7 w-7 mx-auto rounded-lg text-xs font-medium flex items-center justify-center transition-colors " +
                  (isSelected
                    ? "bg-indigo-600 text-white font-bold shadow-sm"
                    : isToday
                    ? "border border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-slate-700"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700");
                dayBtn.addEventListener("click", function () {
                  state.year = viewYear;
                  state.month = viewMonth;
                  state.day = dayNum;
                  // Se selecionou a data mínima, garante que hora/minuto não estejam no passado
                  if (
                    state.year === minDate.getFullYear() &&
                    state.month === minDate.getMonth() &&
                    state.day === minDate.getDate()
                  ) {
                    if (state.hour < minDate.getHours()) {
                      state.hour = minDate.getHours();
                    }
                    if (state.hour === minDate.getHours() && state.minute < minDate.getMinutes()) {
                      state.minute = minDate.getMinutes();
                    }
                  }
                  render();
                });
              }
              dayBtn.textContent = dayNum;
              daysGrid.appendChild(dayBtn);
            })(d);
          }

          calCol.appendChild(daysGrid);
          topGrid.appendChild(calCol);

          // Verifica se o dia selecionado é o mesmo dia do limite mínimo
          var isSameAsMinDay =
            state.year === minDate.getFullYear() &&
            state.month === minDate.getMonth() &&
            state.day === minDate.getDate();

          if (isSameAsMinDay) {
            if (state.hour < minDate.getHours()) {
              state.hour = minDate.getHours();
            }
            if (state.hour === minDate.getHours() && state.minute < minDate.getMinutes()) {
              state.minute = minDate.getMinutes();
            }
          }

          // Coluna de Hora e Minuto (4 colunas)
          var timeCol = document.createElement("div");
          timeCol.className = "col-span-4 flex flex-col";

          var timeHeader = document.createElement("div");
          timeHeader.className = "grid grid-cols-2 text-center text-[10px] font-bold uppercase text-slate-400 mb-1.5";
          timeHeader.innerHTML = "<span>Hora</span><span>Min</span>";
          timeCol.appendChild(timeHeader);

          var listsWrap = document.createElement("div");
          listsWrap.className = "grid grid-cols-2 gap-1 h-44";

          var hourList = document.createElement("div");
          hourList.className = "overflow-y-auto space-y-0.5 pr-0.5";
          for (var h = 0; h < 24; h++) {
            (function (hVal) {
              var hBtn = document.createElement("button");
              hBtn.type = "button";
              var isPastHour = isSameAsMinDay && hVal < minDate.getHours();
              var active = state.hour === hVal;
              if (isPastHour) {
                hBtn.disabled = true;
                hBtn.className =
                  "w-full py-1 rounded-md text-xs font-normal text-center text-slate-300 dark:text-slate-600 line-through cursor-not-allowed opacity-45";
              } else {
                hBtn.className =
                  "w-full py-1 rounded-md text-xs font-semibold text-center transition-colors " +
                  (active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700");
                hBtn.addEventListener("click", function () {
                  state.hour = hVal;
                  if (isSameAsMinDay && state.hour === minDate.getHours() && state.minute < minDate.getMinutes()) {
                    state.minute = minDate.getMinutes();
                  }
                  render();
                });
              }
              hBtn.textContent = pad(hVal);
              hourList.appendChild(hBtn);
            })(h);
          }

          var minList = document.createElement("div");
          minList.className = "overflow-y-auto space-y-0.5 pr-0.5";
          for (var m = 0; m < 60; m++) {
            (function (mVal) {
              var mBtn = document.createElement("button");
              mBtn.type = "button";
              var isPastMin = isSameAsMinDay && state.hour === minDate.getHours() && mVal < minDate.getMinutes();
              var active = state.minute === mVal;
              if (isPastMin) {
                mBtn.disabled = true;
                mBtn.className =
                  "w-full py-1 rounded-md text-xs font-normal text-center text-slate-300 dark:text-slate-600 line-through cursor-not-allowed opacity-45";
              } else {
                mBtn.className =
                  "w-full py-1 rounded-md text-xs font-semibold text-center transition-colors " +
                  (active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700");
                mBtn.addEventListener("click", function () {
                  state.minute = mVal;
                  render();
                });
              }
              mBtn.textContent = pad(mVal);
              minList.appendChild(mBtn);
            })(m);
          }

          listsWrap.appendChild(hourList);
          listsWrap.appendChild(minList);
          timeCol.appendChild(listsWrap);
          topGrid.appendChild(timeCol);

          popover.appendChild(topGrid);

          // Rodapé com Limpar, Hoje e Botão de Confirmação (✓ Confirmar)
          var footer = document.createElement("div");
          footer.className =
            "mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2";

          var leftActions = document.createElement("div");
          leftActions.className = "flex items-center gap-1.5";

          var btnLimpar = document.createElement("button");
          btnLimpar.type = "button";
          btnLimpar.className =
            "px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors";
          btnLimpar.textContent = "Limpar";
          btnLimpar.addEventListener("click", clearAndClose);

          var btnHoje = document.createElement("button");
          btnHoje.type = "button";
          btnHoje.className =
            "px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors";
          btnHoje.textContent = "Agora";
          btnHoje.addEventListener("click", function () {
            var currentNow = new Date();
            state.year = currentNow.getFullYear();
            state.month = currentNow.getMonth();
            state.day = currentNow.getDate();
            state.hour = currentNow.getHours();
            state.minute = currentNow.getMinutes();
            viewYear = state.year;
            viewMonth = state.month;
            render();
          });

          leftActions.appendChild(btnLimpar);
          leftActions.appendChild(btnHoje);

          var btnConfirmar = document.createElement("button");
          btnConfirmar.type = "button";
          btnConfirmar.className =
            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95";
          btnConfirmar.innerHTML =
            '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg><span>Confirmar</span>';
          btnConfirmar.addEventListener("click", applyAndClose);

          footer.appendChild(leftActions);
          footer.appendChild(btnConfirmar);
          popover.appendChild(footer);

          // Centraliza a hora e o minuto selecionados apenas na lista interna (sem rolar a página)
          setTimeout(function () {
            positionPopover();
            var activeHour = hourList.querySelector(".bg-indigo-600");
            var activeMin = minList.querySelector(".bg-indigo-600");
            if (activeHour) {
              hourList.scrollTop = activeHour.offsetTop - hourList.clientHeight / 2 + activeHour.clientHeight / 2;
            }
            if (activeMin) {
              minList.scrollTop = activeMin.offsetTop - minList.clientHeight / 2 + activeMin.clientHeight / 2;
            }
          }, 0);
        }

        render();
        document.body.appendChild(popover);
        positionPopover();

        activeReposition = function (e) {
          if (e && e.target && popover.contains(e.target)) return;
          positionPopover();
        };
        window.addEventListener("scroll", activeReposition, true);
        window.addEventListener("resize", activeReposition);
      }

      displayInput.addEventListener("click", openPicker);
      triggerBtn.addEventListener("click", function () {
        if (activePopover && activeWrapper === wrapper) {
          // Se o seletor já estiver aberto, clicar no ícone também confirma
          var confirmBtn = activePopover.querySelector("button.bg-emerald-600");
          if (confirmBtn) confirmBtn.click();
        } else {
          openPicker();
        }
      });

      if (displayInput.dataset.dtpAutofocus === "true") {
        setTimeout(openPicker, 150);
      }
    });
  }

  /* 5. Spinner Leve ao Enviar Formulários */
  function initFormLoadingState() {
    var forms = document.querySelectorAll("form[data-loading-form]");
    forms.forEach(function (form) {
      form.addEventListener("submit", function () {
        if (!form.checkValidity()) return;
        var submitBtn = form.querySelector("button[type='submit'], button:not([type])");
        if (!submitBtn || submitBtn.dataset.submitting === "true") return;

        submitBtn.dataset.submitting = "true";
        submitBtn.disabled = true;
        submitBtn.classList.add("opacity-80", "cursor-wait");

        var spinner = submitBtn.querySelector("[data-btn-spinner]");
        var label = submitBtn.querySelector("[data-btn-label]");
        if (spinner) spinner.classList.remove("hidden");
        if (label && submitBtn.dataset.loadingText) {
          label.textContent = submitBtn.dataset.loadingText;
        }
      });
    });
  }

  /* 6. Mostrar/Ocultar Senha na Tela de Login */
  function initPasswordToggle() {
    var toggleBtn = document.getElementById("toggle-password-btn");
    var pwdInput = document.getElementById("input-senha");
    var eyeOpen = document.getElementById("eye-open");
    var eyeOff = document.getElementById("eye-off");

    if (!toggleBtn || !pwdInput) return;

    toggleBtn.addEventListener("click", function () {
      var isPassword = pwdInput.type === "password";
      pwdInput.type = isPassword ? "text" : "password";
      if (eyeOpen && eyeOff) {
        eyeOpen.classList.toggle("hidden", isPassword);
        eyeOff.classList.toggle("hidden", !isPassword);
      }
    });
  }
})();
