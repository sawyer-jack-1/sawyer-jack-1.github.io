---
layout: post
title: "Preprint announcement: 'Robust Graph-Based Semi-Supervised Learning via p-Conductances'"
date: 13 February 2025
author: "Sawyer"
---

I am excited to announce the release of a new preprint 'Robust Graph-Based Semi-Supervised Learning via p-Conductances'. This comes as a sequel of sorts to our earlier paper on effective resistance for probability measures on graphs, and is the result of work by a host of collaborators: Chester Holtz, Zhengchao Wan, Gal Mishne, Alexander Cloninger.

> We study the problem of semi-supervised learning on graphs in the regime where data labels are scarce or possibly corrupted. We propose an approach called  -conductance learning that generalizes the  -Laplace and Poisson learning methods by introducing an objective reminiscent of  -Laplacian regularization and an affine relaxation of the label constraints. This leads to a family of probability measure mincut programs that balance sparse edge removal with accurate distribution separation. Our theoretical analysis connects these programs to well-known variational and probabilistic problems on graphs (including randomized cuts, effective resistance, and Wasserstein distance) and provides motivation for robustness when labels are diffused via the heat kernel. Computationally, we develop a semismooth Newton-conjugate gradient algorithm and extend it to incorporate class-size estimates when converting the continuous solutions into label assignments. Empirical results on computer vision and citation datasets demonstrate that our approach achieves state-of-the-art accuracy in low label-rate, corrupted-label, and partial-label regimes. 