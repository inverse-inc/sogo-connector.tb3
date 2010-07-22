/* pref-editdirectories.overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

jsInclude(["chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js"]);

function SCEditDirectory() {
    let abList = document.getElementById("directoriesList");
    if (abList && abList.selectedItem) {
        let abURI = abList.value;
        let ab = Components.classes["@mozilla.org/abmanager;1"]
                           .getService(Components.interfaces.nsIAbManager)
                           .getDirectory(abURI);
        if (ab.directoryProperties.URI.indexOf("carddav://") == 0) {
            window.openDialog("chrome://sogo-connector/content/addressbook/preferences.addressbook.groupdav.xul",
                              "", "chrome,modal=yes,resizable=no,centerscreen", abURI);
        }
        else {
            this.oldEditDirectory();
        }
    }
}

function onSCLoad() {
    this.oldEditDirectory = this.editDirectory;
    this.editDirectory = this.SCEditDirectory;
}

window.addEventListener("load", onSCLoad, false);
