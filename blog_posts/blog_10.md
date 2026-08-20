---
layout: post
title: "Preprint announcement: 'Optimal Transport on Graphs and Stochastically Evolving Trees'"
date: 20 August 2026
author: "Sawyer"
---

Fan and I are excited to announce the completion of our most recent work titled _Optimal Transport on Graphs and Stochastically Evolving Trees_. The main topic of the paper is an alogrithm for solving the optimal transportation problem on a graph using its spanning trees; this has been a wild goal of sorts of mine over the past few years, as the number of such trees is often impossibly large. However in some settings the approach is actually tractable, and the method of proof was enjoyable to develop: we use a hidden polytope of sorts to get our guarantees. Looking forward to where this method might be deployed in other settings.

[The paper can be found on ArXiv](https://arxiv.org/html/2608.14839v1).

> We give an effective algorithm for determining the transportation distance between two given probability density functions defined on the vertices of a graph $G=(V,E)$ by analyzing an associated \emph{polytope}. The vertices of the polytope correspond to feasible flows on spanning trees in $G$, and the $1$-skeleton of the polytope is a projection of the spanning tree state graph associated with the Glauber dynamics on $G$. The optimal value of this transportation problem, known as the $1$-Wasserstein distance, can be computed by tracing the transportation cost along the vertices of this polytope. We show that a local minimum of the transportation cost is also a global minimum, and this leads to a steepest descent algorithm for solving the transportation problem. If the probability density functions take discrete values in $\delta \mathbb{Z}$ for some $\delta>0$, then the optimal transport cost can be reached in at most $\frac{|V|-1}{\delta}$ steps. As an application, we give an efficient algorithm for computing the Ollivier--Ricci curvature of a graph.

<p align="center">
    <img src="/assets/images/tree_polytope.png" alt="State graph and tree polytope" style="width:450px;">
</p>
