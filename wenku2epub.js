// ==UserScript==
// @name         Wenku8 EPUB Generator
// @namespace    http://youmu.moe/
// @version      0.1
// @description  Export wenku8 lightnovel to epub
// @author       Shuhao Tan
// @match        http://www.wenku8.com/book/*.htm
// @connect      *.wenku8.com
// @connect      *.wkcdn.com
// @connect      wenku8.com
// @connect      wkcdn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @require      https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.0.2/handlebars.min.js
// @require      https://cdn.rawgit.com/eligrey/FileSaver.js/master/FileSaver.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/2.5.0/jszip.min.js
// @require      https://cdn.rawgit.com/Stuk/jszip-utils/master/dist/jszip-utils.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/underscore.string/3.2.2/underscore.string.min.js
// @require      https://cdn.rawgit.com/beautify-web/js-beautify/master/js/lib/beautify-html.js
// @require      https://cdn.rawgit.com/malko/D.js/master/lib/D.min.js
// @require      https://cdn.rawgit.com/johnmave126/js-epub-maker/master/dist/js-epub-maker.min.js
// ==/UserScript==

(function() {
    'use strict';
    var POOL_SIZE = 5;
    var XHRFactory = (function(pool_size) {
        function _(pool_size) {
            var that = this;
            var xhr_pool = 0;
            var queue = [];
            Object.defineProperty(this, 'POOL_SIZE', { value: pool_size });
            this.addTask = function(url, response_type) {
                var deferred = new D();
                var task = {
                    url: url,
                    response_type: response_type,
                    deferred: deferred
                };
                if(xhr_pool < this.POOL_SIZE) {
                    invokeTask(task);
                } else {
                    queue.push(task);
                }
                return deferred.promise;
            };

            function invokeTask(task) {
                xhr_pool++;
                var request_arg = {
                    method: 'GET',
                    url: task.url,
                    onload: function(res) {
                        xhr_pool--;
                        checkNewTask();
                        task.deferred.resolve(res);
                    },
                    onerror: function(res) {
                        xhr_pool--;
                        checkNewTask();
                        task.deferred.reject(res.statusText);
                    },
                    onabort: function(res) {
                        xhr_pool--;
                        checkNewTask();
                        task.deferred.reject(res.statusText);
                    }
                };
                if(task.response_type) {
                    request_arg.responseType = task.response_type;
                }
                GM_xmlhttpRequest(request_arg);
            }

            function checkNewTask() {
                if(xhr_pool < that.POOL_SIZE && queue.length) {
                    invokeTask(queue.shift());
                }
            }
        }

        return new _(pool_size);
    })(POOL_SIZE);
    var FileDatabase = (function() {
        function _() {
            var dict = {};
            var hash = {};

            this.getFilename = function(url, type) {
                if(dict[url]) {
                    return D.resolved(dict[url]);
                } else {
                    return XHRFactory.addTask(url, 'blob')
                        .then(function(res) {
                            var ext = url.substr(url.lastIndexOf('.'));
                            var filename;
                            do {
                                filename = makeID(7) + ext;
                            } while (hash[filename]);
                            hash[filename] = 1;
                            dict[url] = {
                                url: URL.createObjectURL(res.response),
                                type: type,
                                filename: filename
                            };
                            return dict[url];
                        });
                }
            };
            this.getAll = function() {
                return Object.values(dict);
            };
        }

        function makeID(N) {
            var s = "abcdefghijklmnopqrstuvwxyz0123456789";
            return Array(N).join().split(',').map(function() {
                return s.charAt(Math.floor(Math.random() * s.length));
            }).join('');
        }

        return new _();
    })();
    var Q = function(d) {
        return d.querySelector.apply(d, Array.prototype.slice.call(arguments, 1));
    };

    function loadHTML(url) {
        return XHRFactory.addTask(url, 'text')
            .then(function(res) {
                var doc = document.implementation.createHTMLDocument();
                var base, head;
                doc.documentElement.innerHTML = res.responseText;
                base = doc.getElementsByTagName('base')[0];
                if(!base) {
                    base = doc.createElement('base');
                    head = doc.getElementsByTagName('head')[0];
                    base.href = url;
                    head.insertBefore(base, head.firstChild);
                }
                return doc;
            });
    }
    var novel_info;

    function loadNovel() {
        if(novel_info) {
            return D.resolved(novel_info);
        } else {
            var title = Q(document, '#content > div:first-child > table:first-child > tbody > tr:first-child > td:first-child > table tr:first-child span b').textContent;
            var publisher = Q(document, '#content > div:first-child > table:first-child > tbody > tr:nth-child(2) > td:first-child').textContent;
            publisher = publisher.substr(publisher.lastIndexOf('：') + 1);
            var author = Q(document, '#content > div:first-child > table:first-child > tbody > tr:nth-child(2) > td:nth-child(2)').textContent;
            author = author.substr(author.lastIndexOf('：') + 1);
            var last_update = Q(document, '#content > div:first-child > table:first-child > tbody > tr:nth-child(2) > td:nth-child(4)').textContent;
            last_update = last_update.substr(last_update.lastIndexOf('：') + 1);
            last_update = new Date(last_update);
            var cover = Q(document, '#content > div > table:nth-of-type(2) img');

            var menu_link = Q(document, '#content > div legend:first-of-type ~ div a').href;
            var final_obj = {
                title: title,
                publisher: publisher,
                author: author,
                last_update: last_update,
                id: location.href.match(/(\d+)\.htm$/)[1]
            };
            return D.all(
                FileDatabase.getFilename(cover.src, 'image').then(function(file) {
                    final_obj.cover = file;
                }),
                loadHTML(menu_link).then(function(doc) {
                    var cells = doc.querySelectorAll('td.vcss, td.ccss');
                    var promises_vol = [];
                    var i = 0,
                        vc = 0;
                    if(!cells.length) {
                        throw "Book empty";
                    }
                    if(!cells[0].classList.contains('vcss')) {
                        throw "Illformed menu";
                    }
                    while(i < cells.length) {
                        var vol = {
                            title: cells[i].textContent
                        };
                        var cc = 0;
                        var promises_chapter = [];
                        i++;
                        while(i < cells.length && cells[i].classList.contains('ccss')) {
                            var link;
                            if(!!(link = cells[i].querySelector('a'))) {
                                var chapter = {
                                    title: link.textContent
                                };
                                var promise = loadHTML(link.href).then((function(chapter) {
                                    return function(doc) {
                                        var dummy = doc.getElementById('contentdp');
                                        var content = doc.getElementById('content') || doc.getElementById('contentmain');
                                        while(dummy) {
                                            dummy.parentNode.removeChild(dummy);
                                            dummy = doc.getElementById('contentdp');
                                        }
                                        var images = content.querySelectorAll('img');
                                        var promises_images = [];
                                        for(var i = 0; i < images.length; i++) {
                                            var deferred = FileDatabase.getFilename(images[i].src, 'image')
                                                .then((function(img) {
                                                    return function(res) {
                                                        img.setAttribute('src', 'images/' + res.filename);
                                                        if(img.parentNode.nodeName.toLowerCase() == 'a') {
                                                            var a = img.parentNode;
                                                            a.parentNode.replaceChild(img, a);
                                                        }
                                                    };
                                                })(images[i]));
                                            promises_images.push(deferred);
                                        }
                                        //Clean up
                                        var ptr = content.firstChild;
                                        while(ptr) {
                                            var node = ptr;
                                            ptr = ptr.nextSibling;
                                            switch(node.nodeName.toLowerCase()) {
                                                case 'br':
                                                    content.removeChild(node);
                                                    break;
                                                case '#text':
                                                    var text = node.textContent.trim();
                                                    if(text.length) {
                                                        var p = doc.createElement('p');
                                                        p.textContent = text;
                                                        content.replaceChild(p, node);
                                                    } else {
                                                        content.removeChild(node);
                                                    }
                                                    break;
                                                default:
                                                    break;
                                            }
                                        }
                                        return D.all(promises_images).then(function() {
                                            chapter.content = content.innerHTML;
                                            return chapter;
                                        });
                                    };
                                })(chapter));
                                promises_chapter.push(promise);
                                cc++;
                            }
                            i++;
                        }
                        promises_vol.push(D.all(promises_chapter)
                            .then((function(vol) {
                                return function(chapters) {
                                    vol.chapters = chapters;
                                    return vol;
                                };
                            })(vol)));
                    }
                    return D.all(promises_vol).then(function(vols) {
                        final_obj.vol = vols;
                    });
                }, function(err) {
                    console.log(err);
                })
            ).then(function(res) {
                return final_obj;
            });
        }
    }

    function downloadNovel(e) {
        e.preventDefault();
        loadNovel().then(function(novel_info) {
            var epubMaker = new EpubMaker()
                            .withUuid('wenku8::lightnovelnovel::' + novel_info.id)
                            .withTemplate('lightnovel')
                            .withAuthor(novel_info.author)
                            .withLanguage('zh-Cn')
                            .withModificationDate(novel_info.last_update)
                            .withPublisher(novel_info.publisher)
                            .withCover(novel_info.cover.url)
                            .withOption('coverFilename', novel_info.cover.filename)
                            .withOption('tocName', '目录')
                            .withTitle(novel_info.title);

            for(var i = 0; i < novel_info.vol.length; i++) {
                var vol = novel_info.vol[i];
                var vol_section = new EpubMaker.Section('auto-toc', '', {title: vol.title, renderTitle: true});
                for(var j = 0; j < vol.chapters.length; j++) {
                    var chapter = vol.chapters[j];
                    vol_section = vol_section.withSubSection(new EpubMaker.Section('', '', {
                        title: chapter.title,
                        renderTitle: true,
                        content: chapter.content
                    }));
                }
                epubMaker = epubMaker.withSection(vol_section);
            }

            var files = FileDatabase.getAll();
            for(var i = 0; i < files.length; i++) {
                epubMaker = epubMaker.withAdditionalFile(files[i].url, 'images', files[i].filename);
            }

            epubMaker.downloadEpub(function(epubZipContent, filename){
                link.href = URL.createObjectURL(epubZipContent);
                link.download = filename;
                link.removeEventListener('click', downloadNovel);
            });
        });
    }

    var target_container = document.querySelector('fieldset[style*="660px"]');
    var legend = target_container.querySelector('legend');
    var buttons = target_container.querySelectorAll('div');
    legend.textContent = legend.textContent.replace('JAR', 'JAR、EPUB');
    for(var i = 0; i < buttons.length; i++) {
        buttons[i].style.width = '130px';
    }
    var newbutton = buttons[1].cloneNode(true);
    var link = newbutton.querySelector('a');
    link.href = '#';
    link.textContent = link.textContent.replace(/TXT../g, 'EPUB');
    target_container.appendChild(newbutton);

    link.addEventListener('click', downloadNovel);
})();
