document.addEventListener("DOMContentLoaded", function () {
  var container = document.querySelector(".donate-card");
  if (!container) return;

  var amountInput = document.getElementById("donate-amount");
  var amountButtons = container.querySelectorAll(".amount-btn");
  var submitBtn = document.getElementById("donate-submit");
  var messageEl = document.getElementById("donate-message");

  function showMessage(text) {
    messageEl.textContent = text;
    messageEl.hidden = false;
  }

  amountButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      amountButtons.forEach(function (b) {
        b.classList.remove("amount-btn-active");
      });
      btn.classList.add("amount-btn-active");
      amountInput.value = btn.dataset.amount;
    });
  });

  var params = new URLSearchParams(window.location.search);
  if (params.get("donation") === "success") {
    showMessage(container.dataset.msgSuccess);
  } else if (params.get("donation") === "cancelled") {
    showMessage(container.dataset.msgCancelled);
  }

  submitBtn.addEventListener("click", function () {
    var amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
      showMessage(submitBtn.dataset.msgEmpty);
      return;
    }

    submitBtn.disabled = true;

    fetch("/create-donation-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amount, locale: submitBtn.dataset.locale })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("checkout failed");
        return res.json();
      })
      .then(function (data) {
        window.location.href = data.url;
      })
      .catch(function () {
        submitBtn.disabled = false;
        showMessage(submitBtn.dataset.msgError);
      });
  });
});
