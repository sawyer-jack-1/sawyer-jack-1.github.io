---
layout: post
title: "Preprint announcement: 'Robust Tangent Space Estimation via Laplacian Eigenvector Gradient Orthogonalization'"
date: 2 October 2025
author: "Sawyer"
---

I am excited to announce the release of a new preprint, written alongside a collaborator and former UCSD Ph.D. Student Dhruv Kohli and our advisors. The paper combines both of our backgrounds from geometry and random matrix theory, and presents a great new algorithm for tangent space estimation on data manifolds. Check it out!

[The paper can be found on ArXiv](https://arxiv.org/abs/2510.02308).

> Estimating the tangent spaces of a data manifold is a fundamental problem in data analysis. The standard approach, Local Principal Component Analysis (LPCA), struggles in high-noise settings due to a critical trade-off in choosing the neighborhood size. Selecting an optimal size requires prior knowledge of the geometric and noise characteristics of the data that are often unavailable. In this paper, we propose a spectral method, Laplacian Eigenvector Gradient Orthogonalization (LEGO), that utilizes the global structure of the data to guide local tangent space estimation. Instead of relying solely on local neighborhoods, LEGO estimates the tangent space at each data point by orthogonalizing the gradients of low-frequency eigenvectors of the graph Laplacian. We provide two theoretical justifications of our method. First, a differential geometric analysis on a tubular neighborhood of a manifold shows that gradients of the low-frequency Laplacian eigenfunctions of the tube align closely with the manifold's tangent bundle, while an eigenfunction with high gradient in directions orthogonal to the manifold lie deeper in the spectrum. Second, a random matrix theoretic analysis also demonstrates that low-frequency eigenvectors are robust to sub-Gaussian noise. Through comprehensive experiments, we demonstrate that LEGO yields tangent space estimates that are significantly more robust to noise than those from LPCA, resulting in marked improvements in downstream tasks such as manifold learning, boundary detection, and local intrinsic dimension estimation. 

<p align="center">
    <img src="/assets/images/lego_01.png" alt="lego_01" style="width:300px;">
</p>

<p align="center">
    <img src="/assets/images/lego_02.png" alt="lego_02" style="width:300px;">
</p>