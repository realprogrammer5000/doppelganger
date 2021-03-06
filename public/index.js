const basePath = "https://username-lookup-app.herokuapp.com";

// fetch the base path to give heroku some time to warm up, decreasing user waiting time
// noinspection JSIgnoredPromiseFromCall
fetch(`${basePath}`);

let suggestedUsernamesChipSet;

let savedSites = [];
try {
    savedSites = JSON.stringify(localStorage.getItem("savedSites"));
} catch (e) {
}
/*data.forEach((site) => {
	site.saved = savedSites.includes(site.name);
});*/

const mountedOrUpdated = function () {
    if (this.$el.ripples) {
        this.$el.ripples.forEach((ripple) => ripple.destroy());
    }

    if (!this.$el.querySelectorAll) return;

    const selector = ".mdc-button, .mdc-icon-button, .mdc-card__primary-action";
    const ripples = Array.from(this.$el.querySelectorAll(selector)).map(
        (el) => new mdc.ripple.MDCRipple(el)
    );
    ripples.forEach((ripple) => (ripple.unbounded = true));

    // const iconToggles = Array.from(this.$el.querySelectorAll(".toggle")).map(elem => new mdc.iconButton.MDCIconButtonToggle(elem));
    this.$el.ripples = ripples;
    // this.$el.iconToggles = iconToggles;

    if (this.$el.savedToggle) {
        this.$el.savedToggle.destroy();
    }

    this.$el.savedToggle = new mdc.iconButton.MDCIconButtonToggle(
        this.$el.querySelector(".site-save")
    );

    // this.$el
    // 	.querySelector(".site-save")
    // 	.removeEventListener("MDCIconButtonToggle:change", changeListener(this));

    this.$el
        .querySelector(".site-save")
        .addEventListener("MDCIconButtonToggle:change", e => {
            this.$emit("save", this.name, e.detail.isOn);
        });

    this.$el.savedToggle.on = savedSites.includes(this.name);
};

const tips = `
Star a site by pressing <i class="material-icons">star_border</i> on that site card. You can filter for only starred sites.
Alternate usernames can often help you find other accounts.
Click a <i class="material-icons">web</i> icon to open that site's homepage.
`.trim().split("\n");

let resizeTimeout = null;
addEventListener("resize", () => {
    if(resizeTimeout !== null) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => app.columns = Math.floor(innerWidth / 200), 200);
}, {passive: true});

const app = new Vue({
    el: "main",
    data: {
        message: "HI",
        results: null,
        filter: "all",
        search: "",
        username: "",
        showImages: false,
        animateHandler: null,
        savedSitesOnly: false,
        columns: Math.floor(innerWidth / 200),
        loading: false,
        totalRequests: 0,
        finishedRequests: 0,
        noResults: false,
        infoDialog: null,
        alternateUsernames: null,
        showAlternate: false,
        tip: ""
    },
    computed: {
        numOnlyFound: function () {
            return this.results.filter(result => result.exists === "Claimed").length;
        },
        numOnlyNotFound: function () {
            return this.results.length - this.numOnlyFound;
        },
        isNative: function(){
            return typeof Capacitor !== "undefined" && Capacitor.isNative;
        }
    },
    watch: {
        loading: function (loading) {
            searchButton.disabled = loading;
            usernameField.disabled = loading;
        },
        search: function () {
            this.$nextTick(() =>
                this.noResults = this.$el.querySelector("#wrapper") && this.$el.querySelector("#wrapper").childElementCount === 0
            );
        }
    },
    methods: {
        setAlternateDisplay: function(show){
            this.showAlternate = show;
        },
        goHome: function(){
            history.pushState({}, "Username Lookup on Doppelganger.tk", "/");
            document.title = "Username Lookup on Doppelganger.tk";

            app.username = "";
            app.results = null;
            app.alternateUsernames = null;
        },
        animate: function () {
            if (this.animateHandler !== null) clearTimeout(this.animateHandler);
            this.$el.querySelector("#wrapper").classList.remove("animate");
            // needed to toggle animation
            // https://css-tricks.com/restart-css-animation
            void this.$el.querySelector("#wrapper").offsetWidth;
            this.$el.querySelector("#wrapper").classList.add("animate");

            this.animateHandler = setTimeout(() => {
                this.$el.querySelector("#wrapper").classList.remove("animate");
            }, 2000);
        },
        savedSitesOnlyHandler: function (value) {
            this.savedSitesOnly = value;
        },
        showImagesHandler: function (showImages) {
            this.showImages = showImages;
        },
        filterHandler: function (filter) {
            // this.animate();
            setTimeout(() => (this.filter = filter), 0);
        },
        searchHandler: function (search) {
            setTimeout(() => (this.search = search), 0);
        },
        sortHandler: function (sort) {
            // this.animate();
            switch (sort) {
                case "sort-popular-sites":
                    this.results = this.results.sort(
                        (site1, site2) => site1.rank - site2.rank
                    );
                    break;
                case "sort-alphabetical":
                    this.results = this.results.sort((site1, site2) =>
                        site1.name.localeCompare(site2.name)
                    );
                    break;
            }
        },
        save: function (site, save) {
            this.results
                .filter((thisSite) => thisSite.name === site)
                .forEach((thisSite) => (thisSite.saved = save));
            savedSites = this.results.filter((site) => site.saved).map((site) => site.name);
            localStorage.setItem(
                "savedSites",
                JSON.stringify(savedSites)
            );
        },
        searchKeyDown: function () {
            searchButton.activate();
        },
        searchKeyUp: function (e) {
            searchButton.deactivate();
            e.target.blur();
            this.submit();
        },
        lookupHandler : function(username){
            this.username = username;
            this.submit();
        },
        submit: function () {
            if (this.loading) return;
            this.username = this.username.trim();
            history.pushState(
                {username: this.username},
                `${this.username} | Username Lookup`,
                "?" + this.username
            );
            this.lookupUsername();
        },
        lookupUsername: async function () {
            this.tip = tips[Math.floor(Math.random() * tips.length)];
            this.filter = "all";
            this.savedSitesOnly = false;
            document.title = `${this.username} | Username Lookup on Doppelganger.tk`;
            this.username = this.username.trim();
            this.totalRequests = 0;
            this.finishedRequests = 0;
            this.loading = true;
            const {pages} = await (
                await fetch(`${basePath}/pages`)
            ).json();
            const promises = [];

            promises.push((async () => {
                this.alternateUsernames = await (
                    await fetch(`${basePath}/alternateusernames/${this.username}`)
                ).json();
                // resultNames.forEach(usernameObj => this.alternateUsernames[usernameObj.from] ? this.alternateUsernames[usernameObj.from].push(usernameObj) : this.alternateUsernames[usernameObj.from] = [usernameObj]);
                this.finishedRequests++;
            })());

            for (let i = 0; i < pages; i++) {
                promises.push(
                    (async () => {
                        let tries = 0;
                        let data;

                        while (!data && tries < 3) {
                            try {
                                const controller = new AbortController();

                                // kill the request if it takes more than 30s
                                setTimeout(() => controller.abort(), 30 * 1000);

                                data = await (
                                    await fetch(
                                        `${basePath}/lookup/${this.username}?page=${i}&timeout=10`,
                                        {
                                            signal: controller.signal
                                        }
                                    )
                                ).json();
                            } catch (e) {
                                console.error(e);
                            } finally {
                                tries++;
                            }
                        }
                        this.finishedRequests++;
                        return data || [];
                    })()
                );
            }
            this.totalRequests = promises.length;
            const promResults = await Promise.all(promises);
            this.loading = false;
            this.results = promResults.filter(Boolean).flat().filter(function (item, pos, arr) {
                return arr.findIndex((otherItem) => otherItem.name === item.name) === pos;
            });
            this.results.forEach((site) => {
                site.saved = savedSites.includes(site.name);
            });
        },
        selectElem: function (e) {
            e.target.select();
        }
    },
    components: {
        "progress-bar": {
            template: "#progress-bar-template",
            props: {
                progress: Number
            },
            watch: {
                progress: function (progress) {
                    this.$el.progressElem.progress = progress;
                    this.$el.progressElem.buffer = Math.min(progress * 1.1, 1);
                    this.$el.progressElem.determinate = !isNaN(progress);
                }
            },
            mounted: function () {
                this.$el.progressElem = new mdc.linearProgress.MDCLinearProgress(this.$el);
                this.$el.progressElem.open();
                this.$el.progressElem.progress = this.progress;
                this.$el.progressElem.buffer = Math.min(this.progress * 1.1, 1);
                this.$el.progressElem.determinate = !isNaN(this.progress);
            }
        },
        "site-card": {
            template: "#site-card-template",
            data: () => ({showImage: false, renderImage: true}),
            props: {
                exists: String,
                http_status: Number,
                name: String,
                response_time_s: Number,
                url_main: String,
                url_user: String,
                username: String,
                saved: Boolean,
                showImages: Boolean,
                unreliable: Boolean,
                rank: Number
            },
            computed: {
                favicon: function () {
                    return this.url_main + "favicon.ico";
                },
                show: function () {
                    return (
                        (!this.$root.search ||
                            this.name.toLowerCase().includes(this.$root.search.toLowerCase()) ||
                            this.$root.search.toLowerCase().includes(this.name.toLowerCase())) &&
                        (this.$root.filter === "all" ||
                            (this.$root.filter === "only-found" && this.exists === "Claimed") ||
                            (this.$root.filter === "only-not-found" && this.exists !== "Claimed")) &&
                        (!this.$root.savedSitesOnly || this.saved)
                    );
                }
            },
            methods: {
                openPage: function () {
                    open(this.url_main);
                },
                openUserPage: function () {
                    open(this.url_user);
                }
            },
            watch: {
                saved: function (saved) {
                    this.$el.savedToggle.on = saved;
                }
            },
            updated: mountedOrUpdated,
            mounted: mountedOrUpdated
        },
        "search-header": {
            template: "#search-header-template",
            data: () => ({search: ""}),
            props: {
                num: Number,
                numOnlyFound: Number,
                numOnlyNotFound: Number
            },
            watch: {
                search: function () {
                    this.$emit("search", this.search);
                }
            },
            mounted: function () {
                Array.from(this.$el.querySelectorAll(".mdc-chip-set")).map(
                    (elem) => new mdc.chips.MDCChipSet(elem)
                );

                new mdc.textField.MDCTextField(this.$el.querySelector("#list-search"));

                this.$el
                    .querySelector("#list-filter")
                    .addEventListener("MDCChip:selection", (e) => {
                        if (e.detail.selected) {
                            switch (e.detail.chipId) {
                                case "filter-all":
                                    this.$emit("filter", "all");
                                    break;
                                case "filter-only-found":
                                    this.$emit("filter", "only-found");
                                    break;
                                case "filter-only-not-found":
                                    this.$emit("filter", "only-not-found");
                                    break;
                            }
                        }
                    });

                this.$el
                    .querySelector("#list-sort")
                    .addEventListener("MDCChip:selection", (e) => {
                        if (e.detail.selected) {
                            switch (e.detail.chipId) {
                                case "sort-popular-sites":
                                    this.$emit("sort", "sort-popular-sites");
                                    app.results = app.results.sort(
                                        (site1, site2) => site1.rank - site2.rank
                                    );
                                    break;
                                case "sort-alphabetical":
                                    this.$emit("sort", "sort-alphabetical");
                                    app.results = app.results.sort((site1, site2) =>
                                        site1.name.localeCompare(site2.name)
                                    );
                                    break;
                            }
                        }
                    });

                this.$el
                    .querySelector("#starred-sites-only")
                    .addEventListener("MDCChip:selection", (e) => {
                        this.$emit("saved-sites-only", e.detail.selected);
                    });

                this.$el
                    .querySelector("#list-image-toggle")
                    .addEventListener("MDCChip:selection", (e) => {
                        if (e.detail.selected) {
                            this.$emit("show-images", e.detail.chipId === "show-images");
                        }
                    });
            }
        },
        "alt-username-chip": {
            template: "#alt-username-chip-template",
            props: {
                from: String,
                icon: String,
                lastUsed: String,
                username: String
            },
            mounted: function(){
                if(suggestedUsernamesChipSet) suggestedUsernamesChipSet.initialize();
                else suggestedUsernamesChipSet = new mdc.chips.MDCChipSet(this.$el.parentElement);
            },
            computed: {
                dateString: function(){
                    return (new Date(this.lastUsed)).toLocaleDateString();
                }
            },
            methods: {
                emitLookup: function(){
                    this.$emit("lookup", this.username);
                    this.$emit("alternate-toggle");
                }
            }
        },
        "alternate-toggle": {
            template: "#alternate-toggle-template",
            props: {
                numAlternates: Number
            },
            mounted: function(){
                const button = this.$el.querySelector("button");
                this.$el.button = new mdc.iconButton.MDCIconButtonToggle(button);
                button.addEventListener("MDCIconButtonToggle:change", ({detail}) => this.$emit("alternate-toggle", detail.isOn));
            },
            methods: {
                alternateToggle: function(){
                    this.$el.button.on = !this.$el.button.on;
                    this.$emit("alternate-toggle", this.$el.button.on);
                }
            }
        }
    },
    mounted: function(){
        this.infoDialog = new mdc.dialog.MDCDialog(document.querySelector("#info-dialog"));
    }
});

const searchButton = new mdc.ripple.MDCRipple(
    document.querySelector("#search-button")
);

const usernameField = new mdc.textField.MDCTextField(
    document.querySelector("#search-field")
);

new mdc.topAppBar.MDCTopAppBar(document.querySelector("header"));

onpopstate = (event) => {
    console.log("popstate");
    if(event.state && event.state.username) {
        app.username = event.state.username;
        app.lookupUsername();
    }else{
        app.username = "";
        app.results = null;
    }
};

if (location.search) {
    app.username = location.search.slice(1);
    usernameField.value = app.username;
    app.lookupUsername();
    history.replaceState(
        {username: app.username},
        `${app.username} | Username Lookup on Doppelganger.tk`,
        "?" + app.username
    );
}
