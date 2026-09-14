import { Module } from "../core/Module.js";
import { Project } from "./Project.js";

/**
 * Installs the song model.
 *
 * Provides the two services every other feature builds on: `project` (tracks,
 * clips, selection, transport settings) and `parameters` (the parameter matrix
 * owned by that project). Both are provided during install, because modules
 * installed after this one look them up while they install.
 */
export class ProjectModule extends Module {
  /** @type {Project|null} */
  project = null;

  /**
   * @param {import("../core/App.js").App} app
   */
  install(app) {
    this.project = new Project(app.bus);
    app.provide("project", this.project);
    app.provide("parameters", this.project.parameters);
  }
}
