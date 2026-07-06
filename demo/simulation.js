import chalk from "chalk";
import Node from "../models/Node.js";

function runSimulation() {

    console.clear();

    console.log(chalk.blue("==================================="));
    console.log(chalk.blue(" Distributed Key Value Store Demo "));
    console.log(chalk.blue("==================================="));

    console.log();

    console.log(chalk.green("Project started successfully."));


    const nodeA = new Node("Node A");

    const nodeB = new Node("Node B");

    const nodeC = new Node("Node C");

    console.log(chalk.green(nodeA.name), nodeA.position);

    console.log(chalk.green(nodeB.name), nodeB.position);

    console.log(chalk.green(nodeC.name), nodeC.position);

}

export default runSimulation;