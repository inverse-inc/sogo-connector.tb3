/* messenger.groupdav.overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2010
 *    Author: Robert Bolduc, Wolfgang Sourdeau
 *     Email: support@inverse.ca
 *       URL: http://inverse.ca
 *
 * "SOGo Connector" is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 as published by
 * the Free Software Foundation;
 *
 * "SOGo Connector" is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * "SOGo Connector"; if not, write to the Free Software Foundation, Inc., 51
 * Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("messenger.groupdav.overlay.js: failed to include '" + files[i] +
                 "'\n" + e
                 + "\nFile: " + e.fileName
                 + "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://sogo-connector/content/addressbook/folder-handling.js",
           "chrome://sogo-connector/content/common/common-dav.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/vcards.utils.js",
           "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js"]);

/*
 * This overlay adds GroupDAV functionalities to Addressbooks
 * it contains the observers needed by the addressBook and the cards dialog
 */

let groupdavSynchronizationObserver = {
    count: 0,
    handleNotification: function(notification, data) {
        let active = (this.count > 0);
        let throbber = document.getElementById("navigator-throbber");
        /* Throbber may not exist, thus we need to check the returned value. */
        if (notification == "groupdav.synchronization.start") {
            this.count++;
            if (!active) {
                dump("GETTING BUSY\n");
                if (throbber)
                    throbber.setAttribute("busy", true);
            }
        }
        else if (notification == "groupdav.synchronization.stop") {
            this.count--;
            if (active) {
                dump("RESTING\n");
                if (throbber)
                    throbber.setAttribute("busy", false);
            }
        }
    }
};

function OnLoadMessengerOverlay() {
    /* if SOGo Integrator is present, we let it take the startup procedures */

    let nmgr = Components.classes["@inverse.ca/notification-manager;1"]
                         .getService(Components.interfaces.inverseIJSNotificationManager)
                         .wrappedJSObject;
    nmgr.registerObserver("groupdav.synchronization.start",
                          groupdavSynchronizationObserver);
    nmgr.registerObserver("groupdav.synchronization.stop",
                          groupdavSynchronizationObserver);

    if (!this.sogoIntegratorStartupOverlayOnLoad) {
        dump("startup from sogo-connector\n");
        cleanupAddressBooks();
        startFolderSync();
    }
    else
        dump("skipping startup, sogo-integrator present\n");

    window.addEventListener("unload", SCUnloadHandler, false);
}

function SCUnloadHandler(event) {
    let nmgr = Components.classes["@inverse.ca/notification-manager;1"]
                         .getService(Components.interfaces.inverseIJSNotificationManager)
                         .wrappedJSObject;
    nmgr.unregisterObserver("groupdav.synchronization.start",
                            groupdavSynchronizationObserver);
    nmgr.unregisterObserver("groupdav.synchronization.stop",
                            groupdavSynchronizationObserver);
}

function cleanupAddressBooks() {
    let prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);

    // 	_cleanupLocalStore();
    let uniqueChildren = _uniqueChildren(prefs, "ldap_2.servers", 2);
    _cleanupABRemains(prefs, uniqueChildren);
    uniqueChildren = _uniqueChildren(prefs, "ldap_2.servers", 2);
    _cleanupBogusAB(prefs, uniqueChildren);

    uniqueChildren = _uniqueChildren(prefs,
                                     "extensions.ca.inverse.addressbook.groupdav.ldap_2.servers",
                                     7);
    _cleanupOrphanDAVAB(prefs, uniqueChildren);
    _migrateOldCardDAVDirs(prefs, uniqueChildren);
}

function _uniqueChildren(prefs, path, dots) {
    let count = {};
    let children = prefs.getChildList(path, count);
    let uniqueChildren = {};
    for (let i = 0; i < children.length; i++) {
        let leaves = children[i].split(".");
        uniqueChildren[leaves[dots]] = true;
    }

    return uniqueChildren;
}

function _cleanupABRemains(prefs, uniqueChildren) {
    let path = "ldap_2.servers";

    for (let key in uniqueChildren) {
        let branchRef = path + "." + key;
        let count = {};
        let children = prefs.getChildList(branchRef, count);
        if (children.length < 2) {
            if (children[0] == (branchRef + ".position"))
                prefs.deleteBranch(branchRef);
        }
    }
}

function _cleanupBogusAB(prefs, uniqueChildren) {
    let path = "ldap_2.servers";

    for (let key in uniqueChildren) {
        if (key != "default") {
            let uriRef = path + "." + key + ".uri";
            let uri = null;
            // 			dump("trying: " + uriRef + "\n");
            try {
                uri = prefs.getCharPref(uriRef);
                if (uri.indexOf("moz-abldapdirectory:") == 0) {
                    dump("deleting: " + path + "." + key + "\n");
                    prefs.deleteBranch(path + "." + key);
                    // 			dump("uri: " + uri + "\n");
                }
            }
            catch(e) {};
        }
    }
}

function _cleanupOrphanDAVAB(prefs, uniqueChildren) {
    var	path = "extensions.ca.inverse.addressbook.groupdav.ldap_2.servers";
    for (let key in uniqueChildren) {
        let otherRef = "ldap_2.servers." + key + ".description";
        // 		dump("XXXX otherRef: " + otherRef + "\n");
        try {
            prefs.getCharPref(otherRef);
        }
        catch(e) {
            // 			dump("exception: " + e + "\n");
            dump("deleting orphan: " + path + "." + key + "\n");
            prefs.deleteBranch(path + "." + key);
        }
    }
}

function _migrateOldCardDAVDirs(prefs, uniqueChildren) {
    var	path = "extensions.ca.inverse.addressbook.groupdav.ldap_2.servers.";
    for (let key in uniqueChildren) {
        let fullPath = path + key;
        try {
            let isCardDAV = (prefs.getCharPref(fullPath + ".readOnly") == "true");
            if (isCardDAV) {
                dump("######### trying to migrate " + key + "\n");
                let description = "" + prefs.getCharPref(fullPath + ".name");
                let url = "" + prefs.getCharPref(fullPath + ".url");
                dump("description: " + description + "\n");
                dump("url: " + url + "\n");
                if (description.length > 0
                    && url.length > 0) {
                    try {
                        prefs.deleteBranch(fullPath);
                    }
                    catch(x) {};
                    try {
                        prefs.deleteBranch("ldap_2.servers." + key);
                    }
                    catch(y) {};
                    SCCreateCardDAVDirectory(description, url);
                    // 					dump("********* migrated CardDAV: " + key + "\n");
                }
            }
        }
        catch(e) {}
    }
}

function startFolderSync() {
    let rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                               .getService(Components.interfaces.nsIRDFService);
    let parentDir = rdfService.GetResource("moz-abdirectory://")
                              .QueryInterface(Components.interfaces.nsIAbDirectory);
    let children = parentDir.childNodes;
    while (children.hasMoreElements()) {
        let ab = children.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
        let realAB = ab.QueryInterface(Components.interfaces.nsIAbDirectory);
        if (isGroupdavDirectory(ab.Value)) {
            let synchronizer = new GroupDavSynchronizer(ab.Value, false);
            synchronizer.start();
        }
    }
}

function SCSynchronizeFromChildWindow(uri) {
    this.setTimeout(SynchronizeGroupdavAddressbook, 100, uri, null);
}

window.addEventListener("load", OnLoadMessengerOverlay, false);
