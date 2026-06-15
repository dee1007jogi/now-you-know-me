(function() {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js";
    script.onload = () => {
        const lenis = new Lenis({
            smooth: true,
            smoothTouch: true,
            lerp: 0.08,
            wheelMultiplier: 0.8
        });
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    };
    document.head.appendChild(script);
})();
