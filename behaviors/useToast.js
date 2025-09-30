// Lightweight toast behavior without external dependency to avoid module resolution issues
const useToastBehavior = Behavior({
  methods: {
    onShowToast(selector, message) {
      try {
        wx.showToast({ title: String(message || ''), icon: 'none', duration: 1500 });
      } catch (e) {}
    },
    onHideToast() {
      try { wx.hideToast(); } catch (e) {}
    },
  },
});

export default useToastBehavior;
