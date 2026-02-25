// 随机日历数据生成
const randomStatus = () => {
  const r = Math.random();
  // 降低补签(3)出现的概率：60% 已签到，30% 待签到，10% 可补签
  if (r < 0.6) return 1;
  if (r < 0.9) return 2;
  return 3;
};
const randomBool = () => Math.random() < 0.5;
const randomCalendar = () => {
  const arr = new Array(7).fill(0).map(() => ({
    status: randomStatus(), // 1 已签到，2 待签到，3 可补签
    hasReward: false,
    rewards: null,
  }));
  // 第 3 天：固定有周卡奖励
  arr[2] = {
    status: randomStatus(),
    hasReward: true,
    rewards: [{ rewardType: 1, rewardReceived: false }], // 1：周卡
  };
  // 第 7 天：CDK + 周卡
  arr[6] = {
    status: randomStatus(),
    hasReward: true,
    rewards: [
      { rewardType: 2, rewardReceived: false }, // 2：游戏 CDK
      { rewardType: 1, rewardReceived: false },
    ],
  };

  let prevSigned = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].status === 1) {
      if (prevSigned !== -1) {
        for (let k = prevSigned + 1; k < i; k++) {
          if (arr[k].status !== 1) arr[k].status = 3;
        }
      }
      prevSigned = i;
    }
  }
  const firstSigned = arr.findIndex((d) => d.status === 1);
  if (firstSigned > -1) {
    for (let k = 0; k < firstSigned; k++) {
      if (arr[k].status !== 1) arr[k].status = 3;
    }
  }
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].status === 3) {
      for (let k = 0; k < i; k++) {
        if (arr[k].status === 2) arr[k].status = 3;
      }
    }
  }
  let continuous = true;
  for (let i = 0; i < arr.length; i++) {
    continuous = continuous && arr[i].status === 1;
    const d = arr[i];
    if (d.hasReward && d.rewards && d.rewards.length) {
      d.rewards = d.rewards.map((r) => ({
        ...r,
        rewardReceived: false,
      }));
    }
  }
  return arr;
};

// 当前页面使用的签到数据（只初始化一次，后续操作都在此基础上修改）
let signinData = randomCalendar();

// 当前正在补签的天数索引
let currentRecheckDayIndex = null;

// 当前因为签到奖励（rewardType=2）触发的抽奖信息
let currentRewardForDraw = null;
// 抽奖来源：null / 'signin'
let drawSource = null;

// 简单 Toast
let toastTimer = null;
function showToast(message) {
  if (!message) return;
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  } else {
    // 清除旧的消息，避免堆积
    container.innerHTML = "";
  }

  const el = document.createElement("div");
  el.className = "toast-message";
  el.textContent = String(message);
  container.appendChild(el);

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (el.parentNode === container) {
      container.removeChild(el);
    }
    if (!container.childNodes.length && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    toastTimer = null;
  }, 2000);
}

// 确认订单弹窗逻辑
function initOrderPopup() {
  if (document.getElementById("order-popup")) return;

  const html = `
    <div class="popup-overlay" id="order-popup-overlay"></div>
    <div class="popup" id="order-popup">
        <div class="close-btn2" id="order-popup-close"></div> 
        <div class="popup-title">确认订单</div>
        <div class="popup-content">
          <img id="order-img" src="" alt="">
          <div class="popup-content-right">
            <div class="content-top" id="order-name"></div>
            <div class="content-middle" id="order-desc"></div>
            <div class="content-bottom">
              <span>¥</span>
              <p class="content-integer" id="order-price-int"></p>
              <p class="content-decimals" id="order-price-dec"></p>
            </div>
          </div>
        </div>
        <div class="popup-payment">
          <div class="payment-color"></div>
          <div class="payment-text">支付方式</div>
        </div>
        <div class="popup-zfb" id="pay-wx-row">
          <div style="display:flex;align-items:center;">
            <img class="zfb-badge" src="../../assets/images/blind/weixin3.png" alt="">微信
          </div>
          <div class="mock-checkbox checked" id="cb-wx"></div>
        </div>
        <div class="popup-zfb" id="pay-zfb-row">
          <div style="display:flex;align-items:center;">
            <img class="zfb-badge" src="../../assets/images/blind/zfb.png" alt="">支付宝
          </div>
          <div class="mock-checkbox" id="cb-zfb"></div>
        </div>
        <div class="popup-pay">
          <div class="pay-btn" id="btn-pay-now">立即支付</div>
        </div>
        <div class="popup-18">
          <div class="popup-18-checkbox">
            <div class="mock-checkbox mock-checkbox-small checked" id="cb-proto"></div>
          </div>
          <p><span>我已满18岁，已阅读并同意</span><span style="color:#056DE8">《活动规则》</span></p>
        </div>
    </div>
  `;
  const div = document.createElement("div");
  div.innerHTML = html;
  while (div.firstChild) {
    document.body.appendChild(div.firstChild);
  }

  // Bind events
  document.getElementById("order-popup-close").onclick = closeOrderPopup;
  document.getElementById("order-popup-overlay").onclick = closeOrderPopup;

  // Payment method toggle
  const cbWx = document.getElementById("cb-wx");
  const cbZfb = document.getElementById("cb-zfb");

  document.getElementById("pay-wx-row").onclick = () => {
    cbWx.classList.add("checked");
    cbZfb.classList.remove("checked");
  };
  document.getElementById("pay-zfb-row").onclick = () => {
    cbZfb.classList.add("checked");
    cbWx.classList.remove("checked");
  };

  document.getElementById("btn-pay-now").onclick = () => {
    showToast("静态示例无法发起支付请求");
  };
}

function renderOrderPopup(item) {
  initOrderPopup();
  const popup = document.getElementById("order-popup");
  const overlay = document.getElementById("order-popup-overlay");

  // Update content
  document.getElementById("order-img").src = item.verticalCover || item.cover || "";
  document.getElementById("order-name").textContent = item.name;
  document.getElementById("order-desc").textContent = `${
    item.speciesName || "标准版"
  }/数量X1`;

  const price = String(item.discountPrice || item.price || "0").split(".");
  document.getElementById("order-price-int").textContent = price[0];
  document.getElementById("order-price-dec").textContent = price[1]
    ? "." + price[1]
    : "";
  document.getElementById("order-price-dec").style.display = price[1]
    ? "block"
    : "none";

  // Show
  overlay.classList.add("show");
  // Small delay to allow transition
  setTimeout(() => {
    popup.classList.add("show");
  }, 10);
}

function closeOrderPopup() {
  const popup = document.getElementById("order-popup");
  const overlay = document.getElementById("order-popup-overlay");
  if (popup) popup.classList.remove("show");
  if (overlay) {
    setTimeout(() => {
      overlay.classList.remove("show");
    }, 300);
  }
}

// 工具：创建元素
function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

// 根据签到数据渲染日历
function renderSigninList() {
  const listEl = document.getElementById("signin-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  const data = signinData;

  data.forEach((item, index) => {
    const dayNum = index + 1;
    const stateClass =
      item.status === 1 ? "checked" : item.status === 3 ? "recheck" : "unchecked";

    const itemEl = createEl(
      "div",
      ["signin-item", stateClass, rewardWidthClass(item)].filter(Boolean).join(" ")
    );

    // 天数
    itemEl.appendChild(createEl("div", "signin-day", `第${dayNum}天`));

    // 奖励图标或签到图标
    if (item.hasReward && item.rewards && item.rewards.length) {
      const rewardIcons = createEl("div", "reward-icons");
      item.rewards.forEach((rv) => {
        const wrap = createEl("div", "reward-wrap");
        const icon = createEl("div", rewardClass(item, rv));
        wrap.appendChild(icon);
        if (item.status === 1) {
          wrap.appendChild(createEl("div", "signin-icon icon-checked overlay-reward"));
        }
        rewardIcons.appendChild(wrap);
      });
      itemEl.appendChild(rewardIcons);
    } else {
      itemEl.appendChild(createEl("div", "signin-icon " + iconClass(item)));
    }

    // 底部按钮/文案（纯前端效果，不做真实接口）
    const bottom = createEl("div", "signin-bottom");
    if (item.status === 1) {
      if (item.hasReward && item.rewards && item.rewards.length) {
        item.rewards.forEach((rv, rIndex) => {
          const received = !!rv.rewardReceived;
          const btn = createEl(
            "div",
            "signin-recheck-btn" + (received ? " signin-view-btn" : ""),
            received ? "查看" : "领取"
          );
          btn.addEventListener("click", () => handleRewardClick(index, rIndex));
          bottom.appendChild(btn);
        });
      } else {
        bottom.textContent = "已签到";
      }
    } else if (item.status === 3) {
      const btn = createEl("div", "signin-recheck-btn", "补签");
      btn.addEventListener("click", () => openReSignDialog(index));
      bottom.appendChild(btn);
    } else if (item.status === 2) {
      if (item.hasReward && item.rewards && item.rewards.length) {
        item.rewards.forEach((rv, rIndex) => {
          const btn = createEl("div", "signin-recheck-btn", "领取");
          btn.addEventListener("click", () => handleRewardClick(index, rIndex));
          bottom.appendChild(btn);
        });
      }
    }

    itemEl.appendChild(bottom);
    listEl.appendChild(itemEl);
  });
}

function iconClass(item) {
  if (item.status === 1) return "icon-checked";
  if (item.status === 3) return "icon-recheck";
  return "icon-check";
}

function rewardClass(item, reward) {
  const base =
    reward && reward.rewardType === 1
      ? "reward-flyy"
      : reward && reward.rewardType === 2
      ? "reward-cdk"
      : "";
  let end = "";
  if (item.status === 1 && reward && reward.rewardReceived) {
    end = "-ed";
  }
  return ["reward-icon", base + end].join(" ");
}

function rewardWidthClass(item) {
  if (!item.hasReward) return "";
  const n = (item.rewards && item.rewards.length) || 0;
  if (n >= 4) return "reward-4";
  if (n === 3) return "reward-3";
  if (n === 2) return "reward-2";
  return "";
}

// 前面是否有未签到/需补签的天，返回第一个索引；否则返回 -1
function findFirstNeedRecheckIndex(targetDayIndex) {
  for (let i = 0; i < targetDayIndex; i++) {
    if (!signinData[i] || signinData[i].status !== 1) return i;
  }
  return -1;
}

// 是否需要补签（拷贝自 Vue 版 needsRecheck 逻辑）
function needsRecheck(dayNum) {
  try {
    for (let k = 0; k < dayNum - 1; k++) {
      if ((signinData[k] && signinData[k].status) !== 1) return true;
    }
    return false;
  } catch (e) {
    return true;
  }
}

// 动画初始化
let animation = null;
function initAnimation() {
  if (animation) return;
  const container = document.getElementById("animation-container");
  // 尝试访问全局 lottie 对象
  const lottie = window.lottie;
  if (!container || !lottie) return;

  // 动画文件路径
  const animationPath = "./animation/cfg1/data.json";

  try {
      animation = lottie.loadAnimation({
        container: container,
        renderer: "svg",
        loop: true,
        autoplay: false,
        path: animationPath,
        rendererSettings: {
          preserveAspectRatio: "xMidYMid slice" // 确保动画填满容器，类似于 background-size: cover
        }
      });
  } catch (e) {
      console.error("Animation load failed", e);
  }
}

// 奖励点击：支持 rewardType=1 / 2 的“领取-查看”逻辑，并还原原始限制
function handleRewardClick(dayIndex, rewardIndex) {
  const item = signinData[dayIndex];
  if (!item || !item.rewards || !item.rewards[rewardIndex]) return;
  const reward = item.rewards[rewardIndex];
  const dayNum = dayIndex + 1;

  // 1-已签到，2-待签到，3-去补签
  if (item.status === 2) {
    showToast(`连续签到${dayNum}天时可领取`);
  } else if (item.status === 1) {
    // 连续签到不足时不给领
    if (needsRecheck(dayNum)) {
      showToast(`连续签到${dayNum}天时可领取`);
      return;
    }
    if (reward.rewardType === 1) {
      // 周卡：一次性领取，直接标记为已领取并展示 CDK
      if (reward.rewardReceived) {
        // 已经领取过，直接展示弹窗（查看逻辑）
        document.getElementById("flyy-cdk-text").textContent =
          "FLYY-STATIC-" + String(dayNum).padStart(2, "0") + "-CDK";
        openDialog("flyy");
        return;
      }
      
      // 未领取，先标记
      reward.rewardReceived = true;
      document.getElementById("flyy-cdk-text").textContent =
        "FLYY-STATIC-" + String(dayNum).padStart(2, "0") + "-CDK";

      // 尝试播放动画
      initAnimation();
      const overlay = document.getElementById("animation-overlay");
      
      if (animation && overlay) {
        overlay.style.display = "flex";
        animation.goToAndPlay(0, true);
        setTimeout(() => {
          animation.stop();
          overlay.style.display = "none";
          openDialog("flyy");
          renderSigninList();
        }, 2400);
      } else {
        openDialog("flyy");
        renderSigninList();
      }
      return;
    }
    if (reward.rewardType === 2) {
      // 已签到的抽奖奖励：第一次点击走抽奖，之后点击走“查看”
      if (!reward.rewardReceived) {
        currentRewardForDraw = { dayIndex, rewardIndex };
        drawSource = "signin";
        openDialog("draw");
      } else {
        const prize = reward.prize || PRIZES[0];
        if (prize) {
          const imgEl = document.getElementById("cdk-prize-img");
          const titleEl = document.getElementById("cdk-prize-title");
          const subEl = document.getElementById("cdk-prize-sub");
          const noEl = document.getElementById("cdk-award-no");
          if (imgEl) imgEl.src = prize.bigPicUrl || prize.picUrl || "";
          if (titleEl) titleEl.textContent = prize.title || prize.shortTitle || "";
          if (subEl) subEl.textContent = "标准版/CDKEY*1";
          if (noEl) noEl.textContent =
            reward.awardNo || "PRIZE-" + prize.id + "-" + String(dayNum).padStart(2, "0");
        }
        openDialog("cdk");
      }
      return;
    }
  } else if (item.status === 3) {
    if (reward.rewardType === 2) {
      // 去补签状态下点击抽奖奖励：直接打开抽奖弹窗
      currentRewardForDraw = { dayIndex, rewardIndex };
      drawSource = "signin";
      openDialog("draw");
      return;
    }
  }
}

// 打开补签弹窗
function openReSignDialog(dayIndex) {
  // 检查前面是否还有需要先补签的天
  const firstNeedIndex = findFirstNeedRecheckIndex(dayIndex);
  if (firstNeedIndex !== -1) {
    showToast(`请先补签第${firstNeedIndex + 1}天`);
    return;
  }
  currentRecheckDayIndex = dayIndex;
  // 静态版默认展示“补签弹窗1”
  openDialog("resign1");
}

// 特卖区静态数据（两页），根据你提供的 drawn-offset 数据整理
const SALE_PAGES = [
  [
    {
      id: 398,
      name: "仁王2 完全版",
      verticalCover:
        "https://imgb.3dmgame.com/images/17555710135735faf44ffea80462dad3b3db011478f6f.jpg",
      originalPrice: 249.0,
      discountPrice: 98.6,
      discount: 4.0,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 399,
      name: "剑星",
      verticalCover:
        "https://imgb.3dmgame.com/images/1755867398103becfe33646884175875c0680fcd242a2.jpg",
      originalPrice: 268.0,
      discountPrice: 199.0,
      discount: 7.4,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 400,
      name: "皇牌空战7：未知空域",
      verticalCover:
        "https://imgb.3dmgame.com/images/1755944006787dcecd3aaf63b4422a036d07357a81468.jpg",
      originalPrice: 498.0,
      discountPrice: 43.0,
      discount: 0.9,
      purchased: false,
      speciesName: "终极版",
      lowestDiscount: true,
    },
    {
      id: 401,
      name: "铁匠铺传奇",
      verticalCover:
        "https://imgb.3dmgame.com/images/1756155089308a6e447675cd8494ebf046c1e228442f8.jpg",
      originalPrice: 76.0,
      discountPrice: 23.8,
      discount: 3.1,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 402,
      name: "风暴崛起",
      verticalCover:
        "https://imgb.3dmgame.com/images/175613671296647940c7ffa05483ea8a3e858f5037f2a.jpg",
      originalPrice: 159.0,
      discountPrice: 102.0,
      discount: 6.4,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 403,
      name: "洛菲水族馆",
      verticalCover:
        "https://imgb.3dmgame.com/images/17558277366786b330ba12fe64d3c91ee96a47169bc4a.jpg",
      originalPrice: 26.0,
      discountPrice: 1.6,
      discount: 0.6,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: true,
    },
    {
      id: 404,
      name: "实习班主任",
      verticalCover:
        "https://imgb.3dmgame.com/images/1756249652624625f1805c96e4b6eb67afe01cb883301.jpg",
      originalPrice: 19.0,
      discountPrice: 3.2,
      discount: 1.7,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 405,
      name: "欢迎来到帕拉迪泽",
      verticalCover:
        "https://imgb.3dmgame.com/images/175614272569789d8195394f2491ba182951915afc454.jpg",
      originalPrice: 173.0,
      discountPrice: 59.0,
      discount: 3.4,
      purchased: false,
      speciesName: "支持者版",
      lowestDiscount: false,
    },
    {
      id: 406,
      name: "双点校园",
      verticalCover:
        "https://imgb.3dmgame.com/images/17561650631407fc7ddc725a64f5494b8401e17f00ae4.jpg",
      originalPrice: 198.0,
      discountPrice: 40.0,
      discount: 2.0,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
  ],
  [
    {
      id: 407,
      name: "只狼：影逝二度",
      verticalCover:
        "https://imgb.3dmgame.com/images/17560059594047d61466cfb564f3199c89217e1c3163f.jpg",
      originalPrice: 268.0,
      discountPrice: 118.0,
      discount: 4.4,
      purchased: false,
      speciesName: "年度版",
      lowestDiscount: false,
    },
    {
      id: 408,
      name: "全面战争：三国",
      verticalCover:
        "https://imgb.3dmgame.com/images/1756000755476a4458a1125e04dd8ab6f0ab64412e906.jpg",
      originalPrice: 268.0,
      discountPrice: 69.0,
      discount: 2.6,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 409,
      name: "艾尔登法环黑夜君临",
      verticalCover:
        "https://imgb.3dmgame.com/images/1755783502408063ed2ba3a724657aa5479ba338d76a5.jpg",
      originalPrice: 198.0,
      discountPrice: 178.0,
      discount: 9.0,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 410,
      name: "九王",
      verticalCover:
        "https://imgb.3dmgame.com/images/17558039347156596038138614bae83f4aaf134212012.jpg",
      originalPrice: 49.0,
      discountPrice: 24.9,
      discount: 5.1,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 411,
      name: "采石场惊魂",
      verticalCover:
        "https://imgb.3dmgame.com/images/1756153237770ea6a9c452db94cce995d4a860b85ba57.jpg",
      originalPrice: 199.0,
      discountPrice: 22.0,
      discount: 1.1,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: true,
    },
    {
      id: 412,
      name: "彼处水如酒",
      verticalCover:
        "https://imgb.3dmgame.com/images/17547332053762b94fb664ba4476e80b23cc171212c8a.jpg?imageView2/0/format/webp",
      originalPrice: 76.0,
      discountPrice: 9.9,
      discount: 1.3,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 413,
      name: "回溯星空",
      verticalCover:
        "https://imgb.3dmgame.com/images/1745464454834e6c6f68d2061409ea58294e8a1b5e9b3.jpg?imageView2/0/format/webp",
      originalPrice: 22.0,
      discountPrice: 15.4,
      discount: 7.0,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 414,
      name: "迷雾侦探",
      verticalCover:
        "https://imgb.3dmgame.com/images/175600827623432b36a8ed4ba4abc92c9bee2120d591f.jpg",
      originalPrice: 58.0,
      discountPrice: 50.0,
      discount: 8.6,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
    {
      id: 415,
      name: "灵魂骇客2",
      verticalCover:
        "https://imgb.3dmgame.com/images/17561880414887c87db2c72fd443c99ca0f17123417da.jpg",
      originalPrice: 379.0,
      discountPrice: 64.4,
      discount: 1.7,
      purchased: false,
      speciesName: "标准版",
      lowestDiscount: false,
    },
  ],
];

let currentSalePage = 0;

function computeCardClasses(item) {
  const overlay = item.purchased
    ? "card-overlay purchased"
    : item.lowestDiscount
    ? "card-overlay lowest"
    : "card-overlay default";
  const img = item.purchased ? "drawn-img purchased" : "drawn-img";
  const badge = item.purchased
    ? "img-bage purchased"
    : item.lowestDiscount
    ? "img-bage lowest"
    : "img-bage default";
  const btn = item.purchased
    ? "drawn-btn drawn-btn2"
    : item.lowestDiscount
    ? "drawn-btn drawn-btn1"
    : "drawn-btn drawn-btn0";
  return { overlay, img, badge, btn };
}

function renderSaleList() {
  const container = document.getElementById("sale-list");
  if (!container) return;
  container.innerHTML = "";
  let list = SALE_PAGES[currentSalePage] || [];
  // lowestDiscount 的商品排在最前面
  list = list
    .slice()
    .sort((a, b) => (b.lowestDiscount === true) - (a.lowestDiscount === true));
  list.forEach((item) => {
    const block = createEl("div", "offset-block");
    const card = createEl("div", "drawn-card");
    const cls = computeCardClasses(item);

    const overlay = createEl("div", cls.overlay);
    card.appendChild(overlay);

    if (!item.purchased && item.discount) {
      const badge = createEl("div", cls.badge, item.discount + "折");
      card.appendChild(badge);
    }

    const img = createEl("img", cls.img);
    img.src = item.verticalCover;
    img.alt = item.name;
    card.appendChild(img);

    const content = createEl("div", "all-content");
    content.appendChild(createEl("p", "all-text all-name", item.name));
    content.appendChild(createEl("p", "all-text all-species", item.speciesName));
    const price = createEl("p", "all-text all-price");
    price.innerHTML = `<span>原价 ¥</span>${item.originalPrice}`;
    content.appendChild(price);
    card.appendChild(content);

    block.appendChild(card);

    const btn = createEl("div", cls.btn);
    if (item.purchased) {
      const already = createEl("div", "drawn-btn-already", "已购买");
      btn.appendChild(already);
    } else {
      const text = createEl("div", "drawn-btn-text");
      text.appendChild(createEl("div", "drawn-btn-buy", "购"));
      text.appendChild(createEl("div", "drawn-btn-money", "¥"));
      text.appendChild(
        createEl("div", "drawn-btn-number", String(item.discountPrice))
      );
      btn.appendChild(text);
    }
    btn.addEventListener("click", () => {
      renderOrderPopup(item);
    });
    block.appendChild(btn);

    container.appendChild(block);
  });
}

// 抽奖静态数据（使用你提供的 prizes）
const PRIZES = [
  {
    id: 401,
    type: "GAME_CDK_SIGN",
    lotteryId: 21,
    title: "仁王3",
    shortTitle: "仁王3",
    picUrl:
      "https://imgs.3dmgame.com/games/671d82e49abd49c68b846639f92d00cf11770282178028.png?x-oss-process=image/interlace,1/format,webp",
    bigPicUrl:
      "https://imgs.3dmgame.com/games/6e060a395d9b491ca13dc5bdfb34d98911770282206963.jpg?x-oss-process=image/interlace,1/format,webp",
  },
  {
    id: 402,
    type: "GAME_CDK_SIGN",
    lotteryId: 21,
    title: "生化危机：安魂曲",
    shortTitle: "生化危机：安魂曲",
    picUrl:
      "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3764200/d478bccdd167e0d8e1f4760bcad7e6bcbbb3258d/header.jpg",
    bigPicUrl:
      "https://imgs.3dmgame.com/games/bde9a59540074f9da5146364bc0cf47211770282277326.jpg?x-oss-process=image/interlace,1/format,webp",
  },
  {
    id: 403,
    type: "GAME_CDK_SIGN",
    lotteryId: 21,
    title: "NBA 2K26",
    shortTitle: "NBA 2K26",
    picUrl:
      "https://imgb.3dmgame.com/images/17558657624881dd3c8e787024f4a9016411c3fc2037e.jpg",
    bigPicUrl:
      "https://imgb.3dmgame.com/images/1756103689837f2b21cefcc5344ef9d5a91a14a619341.jpg?imageView2/0/format/webp",
  },
  {
    id: 404,
    type: "GAME_CDK_SIGN",
    lotteryId: 21,
    title: "蛋丸之地2",
    shortTitle: "蛋丸之地2",
    picUrl:
      "https://imgb.3dmgame.com/images/17542533590529eead0994053404baa659322c40449e3.jpg",
    bigPicUrl:
      "https://imgb.3dmgame.com/images/17558117232515b8a75554fe9491aa23d5d149f68e42a.jpg",
  },
  {
    id: 405,
    type: "GAME_CDK_SIGN",
    lotteryId: 21,
    title: "一起来扫雷",
    shortTitle: "一起来扫雷",
    picUrl:
      "https://imgb.3dmgame.com/images/175364112590201f39139e96c48c68d96cd78a22edeee.jpg",
    bigPicUrl:
      "https://imgb.3dmgame.com/images/1755811875336a55a033944594d52a565792e123741ef.jpg",
  },
  {
    id: 406,
    type: "GAME_CDK_SIGN",
    lotteryId: 21,
    title: "洛菲水族馆",
    shortTitle: "洛菲水族馆",
    picUrl:
      "https://imgb.3dmgame.com/images/17558277362305990801c8f0e4bb38373518340a8ae99.jpg",
    bigPicUrl:
      "https://imgb.3dmgame.com/images/1755827737664b120e7ca9cd84e48a3f00ceb3aae9636.jpg",
  },
  {
    id: 407,
    type: "GAME_CDK_SIGN",
    lotteryId: 21,
    title: "罪域征途",
    shortTitle: "罪域征途",
    picUrl:
      "https://imgs.3dmgame.com/games/d495f5cf07d944b0ac342eef10d948f611769569463355.png?x-oss-process=image/interlace,1/format,webp",
    bigPicUrl:
      "https://imgs.3dmgame.com/games/5c3835c979ee4767b7786fd9b2c1eb6911769569659412.jpg?x-oss-process=image/interlace,1/format,webp",
  },
  {
    id: 408,
    type: "GAME_CDK_SIGN",
    lotteryId: 21,
    title: "东京地下杀手",
    shortTitle: "东京地下杀手",
    picUrl:
      "https://imgb.3dmgame.com/images/17418496945383e79a25516b24c509a6f640c498f9e9f.jpg?imageView2/0/format/webp",
    bigPicUrl:
      "https://imgb.3dmgame.com/images/1749016385610442066fe95f24bdab81099bf30297302.png?imageView2/0/format/webp",
  },
];

const prizeSort = [401, 402, 403, 405, 408, 407, 406, 404];
const lotter = {
  currentIndex: 0,
  isRunning: false,
  speed: 100,
  timerIns: null,
  currentRunCount: 0,
  totalRunCount: 32,
  prizeId: 0,
  targetPrize: null,
  fromSignin: false,
};

// 固定 3x3 奖品格子顺序（按 DOM 中 data-prize-id 顺序）
let prizeCellIds = [401, 402, 403, 404, 999, 405, 406, 407, 408];
let prizeCells = [];

function totalRunStep() {
  return lotter.totalRunCount + prizeSort.indexOf(lotter.prizeId);
}

function initPrizeArea() {
  const area = document.getElementById("prize-area");
  if (!area) return;
  prizeCells = Array.from(area.querySelectorAll(".prize-item"));
  if (prizeCells.length) {
    prizeCellIds = prizeCells.map((el) =>
      parseInt(el.getAttribute("data-prize-id") || "0", 10)
    );
  }
  // 中心“开始抽奖”按钮绑定点击
  prizeCells.forEach((el, idx) => {
    const id = prizeCellIds[idx];
    if (id === 999) {
      el.addEventListener("click", () => startDraw());
    }
  });
}

function startDraw() {
  if (lotter.isRunning) return;
  const fromSignin = drawSource === "signin";
  startDrawInternal(fromSignin);
}

// 签到奖励触发的抽奖
function startDrawForSignin() {
  if (lotter.isRunning) return;
  startDrawInternal(true);
}

function startDrawInternal(fromSignin) {
  lotter.currentRunCount = 0;
  lotter.speed = 100;
  lotter.isRunning = true;

  // 静态版：随机选一个奖品 ID
  const randomPrize = PRIZES[Math.floor(Math.random() * PRIZES.length)];
  lotter.prizeId = randomPrize.id;

  setTimeout(() => {
    stopAtPrize(randomPrize, fromSignin);
  }, 1000);

  startRunAnimation();
}

function startRunAnimation() {
  stopRunAnimation();
  if (lotter.currentRunCount > totalRunStep()) {
    lotter.isRunning = false;
    updatePrizeAreaHighlight();
    return;
  }
  lotter.currentIndex = prizeSort[lotter.currentRunCount % 8];
  updatePrizeAreaHighlight();
  if (lotter.currentRunCount > Math.floor((lotter.totalRunCount * 2) / 3)) {
    lotter.speed = lotter.speed + Math.floor(lotter.currentRunCount / 3);
  }
  lotter.timerIns = setTimeout(() => {
    lotter.currentRunCount++;
    startRunAnimation();
  }, lotter.speed);
}

function stopRunAnimation() {
  if (lotter.timerIns) {
    clearTimeout(lotter.timerIns);
    lotter.timerIns = null;
  }
}

function updatePrizeAreaHighlight() {
  if (!prizeCells.length) return;
  prizeCells.forEach((node, index) => {
    const id = prizeCellIds[index] || 0;
    if (id === lotter.currentIndex) {
      node.classList.add("prize-item-active");
    } else {
      node.classList.remove("prize-item-active");
    }
  });
}

function stopAtPrize(prize, fromSignin) {
  // 抽到奖后，更新 CDK 弹窗内容
  const imgEl = document.getElementById("cdk-prize-img");
  const titleEl = document.getElementById("cdk-prize-title");
  const subEl = document.getElementById("cdk-prize-sub");
  const noEl = document.getElementById("cdk-award-no");
  if (imgEl) imgEl.src = prize.bigPicUrl || prize.picUrl || "";
  if (titleEl) titleEl.textContent = prize.title || prize.shortTitle || "";
  if (subEl) subEl.textContent = "标准版/CDKEY*1";
  const awardNo =
    "PRIZE-" + prize.id + "-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  if (noEl) noEl.textContent = awardNo;

  // 如果是由签到 rewardType=2 触发的抽奖，记录到对应奖励上，并让按钮变为“查看”
  if (fromSignin && currentRewardForDraw) {
    const { dayIndex, rewardIndex } = currentRewardForDraw;
    const item = signinData[dayIndex];
    if (item && item.rewards && item.rewards[rewardIndex]) {
      item.rewards[rewardIndex].rewardReceived = true;
      item.rewards[rewardIndex].prize = { ...prize, awardNo };
      item.rewards[rewardIndex].awardNo = awardNo;
    }
    currentRewardForDraw = null;
    renderSigninList();
  }
  setTimeout(() => {
    // 抽奖结束后关闭抽奖弹窗
    closeDialog("draw");
    // 重置来源
    drawSource = null;
    openDialog("cdk");
  }, 4800);
}

// 弹窗开关
function openDialog(name) {
  const el = document.querySelector('.dialog-overlay[data-dialog="' + name + '"]');
  if (el) el.classList.add("show");
}

function closeDialog(name) {
  const el = document.querySelector('.dialog-overlay[data-dialog="' + name + '"]');
  if (el) el.classList.remove("show");
}

function bindDialogEvents() {
  document.querySelectorAll("[data-dialog-open]").forEach((btn) => {
    const name = btn.getAttribute("data-dialog-open");
    btn.addEventListener("click", () => openDialog(name));
  });
  document.querySelectorAll("[data-dialog-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const overlay = btn.closest(".dialog-overlay");
      if (overlay && overlay.dataset.dialog) {
        closeDialog(overlay.dataset.dialog);
      }
    });
  });
}

// 复制到剪贴板
function bindCopy() {
  const copyFlyy = document.getElementById("copy-flyy");
  const copyCdk = document.getElementById("copy-cdk");

  const copyText = async (text) => {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showToast("已复制到剪贴板：" + text);
    } catch (e) {
      showToast("复制失败，请手动选择复制");
    }
  };

  if (copyFlyy) {
    copyFlyy.addEventListener("click", () => {
      const text = document.getElementById("flyy-cdk-text")?.textContent || "";
      copyText(text);
    });
  }
  if (copyCdk) {
    copyCdk.addEventListener("click", () => {
      const text = document.getElementById("cdk-award-no")?.textContent || "";
      copyText(text);
    });
  }
}

// 盲盒点击示例
function bindBlind() {
  document.querySelectorAll(".blind-list img[data-blind-id]").forEach((img) => {
    img.addEventListener("click", () => {
      const id = img.getAttribute("data-blind-id");
      showToast("跳转站内对应活动页：" + id);
    });
  });
}

// 补签弹窗确认按钮绑定
function bindResignDialog() {
  const btn = document.getElementById("resignin-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (currentRecheckDayIndex != null && signinData[currentRecheckDayIndex]) {
      signinData[currentRecheckDayIndex].status = 1;
      renderSigninList();
    }
    currentRecheckDayIndex = null;
    closeDialog("resign1");
  });
}

// “换一批”按钮：这里简单重新渲染列表即可
function bindRefreshSale() {
  const btn = document.getElementById("refresh-sale");
  if (!btn) return;
  
  let isAnimating = false;
  btn.addEventListener("click", () => {
    if (isAnimating) return;
    
    const container = document.getElementById("sale-list");
    // 确保有容器且 GSAP 已加载
    if (!container || typeof gsap === 'undefined') {
        currentSalePage = (currentSalePage + 1) % SALE_PAGES.length;
        renderSaleList();
        return;
    }

    const cards = container.querySelectorAll(".drawn-card");
    if (cards.length === 0) {
        currentSalePage = (currentSalePage + 1) % SALE_PAGES.length;
        renderSaleList();
        return;
    }

    isAnimating = true;
    
    // 创建时间轴
    const tl = gsap.timeline({
        onComplete: () => {
            isAnimating = false;
        }
    });

    // 1. 旧卡片翻转消失 (0 -> 90度)
    tl.to(cards, {
        duration: 0.3,
        rotationY: 90,
        ease: "power1.in",
        stagger: {
            amount: 0.2,
            from: "start"
        }
    });

    // 2. 动画结束后切换数据并渲染
    tl.call(() => {
        currentSalePage = (currentSalePage + 1) % SALE_PAGES.length;
        renderSaleList();
        
        // 渲染后获取新卡片，设置初始状态为 -90 度
        const newCards = container.querySelectorAll(".drawn-card");
        if (newCards.length > 0) {
            gsap.set(newCards, { rotationY: -90 });
            
            // 3. 新卡片翻转出现 (-90 -> 0度)
            gsap.to(newCards, {
                duration: 0.4,
                rotationY: 0,
                ease: "power1.out",
                stagger: {
                    amount: 0.2,
                    from: "start"
                },
                onComplete: () => {
                    // 确保动画标志位在最后这步也重置（虽然 timeline 的 onComplete 也会触发，但这里是额外的异步动画）
                    // 实际上 timeline 的 onComplete 会在 tl.call 执行完且没有后续 tween 时触发。
                    // 但这里的 gsap.to 是独立的，timeline 不会等待它。
                    // 所以 timeline 的 onComplete 会立即触发，导致 isAnimating 过早变回 false。
                    // 应该把重置逻辑放在这里的 onComplete。
                    isAnimating = false; 
                }
            });
        } else {
            isAnimating = false;
        }
    });
    
    // 覆盖 timeline 的 onComplete，因为我们在 call 里手动管理了结束状态
    tl.eventCallback("onComplete", null);
  });
}

// 中奖名单轮播
function bindNoticeCarousel() {
  const container = document.getElementById("notice-swipe");
  if (!container) return;
  const items = container.querySelectorAll(".notice-item");
  if (items.length < 2) return;

  // Create wrapper
  const wrapper = document.createElement("div");
  wrapper.style.transition = "transform 0.5s ease-in-out";
  
  // Move items to wrapper
  items.forEach((item) => wrapper.appendChild(item));
  
  // Clone first item
  wrapper.appendChild(items[0].cloneNode(true));
  
  container.appendChild(wrapper);

  let index = 0;
  const heightRem = 0.58667;
  const count = items.length + 1;

  setInterval(() => {
    index++;
    wrapper.style.transform = `translateY(-${index * heightRem}rem)`;
    wrapper.style.transition = "transform 0.5s ease-in-out";

    if (index === count - 1) {
      setTimeout(() => {
        wrapper.style.transition = "none";
        wrapper.style.transform = "translateY(0)";
        index = 0;
      }, 500);
    }
  }, 3000);
}

// 初始化
window.addEventListener("DOMContentLoaded", () => {
  renderSigninList();
  renderSaleList();
  initPrizeArea();
  bindDialogEvents();
  bindCopy();
  bindBlind();
  bindRefreshSale();
  bindResignDialog();
  bindNoticeCarousel();
  // 初始化动画
  initAnimation();
});

